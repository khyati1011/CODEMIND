import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { pool } from '../../config/mysql.js';
import { chromaClient, getProjectCollectionName } from '../../config/chroma.js';
import { ChunkMetadata } from '../../models/ChunkMetadata.js';
import { Summary } from '../../models/Summary.js';
import { ChatHistory } from '../../models/ChatHistory.js';
import { OnboardingGuide } from '../../models/OnboardingGuide.js';
import { ingestFromGithub, ingestFromZip } from '../../ingestion/index.js';
import { parseGithubRepoUrl } from '../../ingestion/githubFetcher.js';
import { runAnalysisJob, updateJob } from '../../pipeline/jobRunner.js';
import { askAssistant } from '../../assistant/index.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { requireNonEmptyString, validateProjectId } from '../middleware/validate.js';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.limits.maxUploadBytes },
});

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        j.id AS job_id,
        j.status AS job_status,
        j.progress AS job_progress,
        j.current_stage,
        j.error_message
      FROM projects p
      LEFT JOIN analysis_jobs j
        ON j.id = (
          SELECT j2.id FROM analysis_jobs j2
          WHERE j2.project_id = p.id
          ORDER BY j2.started_at DESC
          LIMIT 1
        )
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/github', async (req, res, next) => {
  try {
    const repoUrl = requireNonEmptyString(req.body?.repoUrl, 'repoUrl');
    const { repo } = parseGithubRepoUrl(repoUrl);
    const projectName =
      typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : repo;

    const projectId = uuidv4();
    const jobId = uuidv4();

    await pool.query(
      `INSERT INTO projects (id, user_id, name, source_type, source_url) VALUES (?, ?, ?, 'github', ?)`,
      [projectId, DEFAULT_USER_ID, projectName, repoUrl]
    );
    await pool.query(
      `INSERT INTO analysis_jobs (id, project_id, status, progress, current_stage) VALUES (?, ?, 'ingesting', 10, 'Fetching repository from GitHub API')`,
      [jobId, projectId]
    );

    (async () => {
      try {
        const fetched = await ingestFromGithub(projectId, repoUrl);
        await pool.query(`UPDATE projects SET default_branch = ? WHERE id = ?`, [
          fetched.defaultBranch,
          projectId,
        ]);
        await runAnalysisJob({
          jobId,
          projectId,
          projectName,
          rootDir: fetched.rootDir,
        });
      } catch (err) {
        await updateJob(jobId, 'failed', 100, 'GitHub ingestion failed', err.message);
      }
    })();

    res.status(202).json({ projectId, jobId, name: projectName, status: 'ingesting' });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('A .zip file upload is required.');
      err.statusCode = 400;
      throw err;
    }

    const originalName = req.file.originalname || 'archive.zip';
    if (!originalName.toLowerCase().endsWith('.zip')) {
      const err = new Error('Only .zip archives are supported.');
      err.statusCode = 400;
      throw err;
    }

    const projectName =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : originalName.replace(/\.zip$/i, '');

    const projectId = uuidv4();
    const jobId = uuidv4();

    await pool.query(
      `INSERT INTO projects (id, user_id, name, source_type) VALUES (?, ?, ?, 'zip')`,
      [projectId, DEFAULT_USER_ID, projectName]
    );
    await pool.query(
      `INSERT INTO analysis_jobs (id, project_id, status, progress, current_stage) VALUES (?, ?, 'ingesting', 10, 'Safely extracting ZIP archive')`,
      [jobId, projectId]
    );

    const fileBuffer = req.file.buffer;
    (async () => {
      try {
        const rootDir = await ingestFromZip(projectId, fileBuffer);
        await runAnalysisJob({
          jobId,
          projectId,
          projectName,
          rootDir,
        });
      } catch (err) {
        await updateJob(jobId, 'failed', 100, 'ZIP extraction failed', err.message);
      }
    })();

    res.status(202).json({ projectId, jobId, name: projectName, status: 'ingesting' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const projectId = validateProjectId(req.params.id);
    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!projects.length) {
      const err = new Error('Project not found.');
      err.statusCode = 404;
      throw err;
    }

    const [jobs] = await pool.query(
      'SELECT * FROM analysis_jobs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1',
      [projectId]
    );
    const [files] = await pool.query(
      'SELECT file_path, directory, language, lines_count, size_bytes, symbol_count, symbols_json, imports_json, exports_json FROM file_metadata WHERE project_id = ? ORDER BY file_path',
      [projectId]
    );

    const summary = await Summary.findOne({ projectId }).lean();
    const onboarding = await OnboardingGuide.findOne({ projectId }).lean();
    const chatHistory = await ChatHistory.find({ projectId }).sort({ createdAt: 1 }).lean();

    res.json({
      project: projects[0],
      job: jobs[0] || null,
      files,
      summary,
      onboarding,
      chatHistory,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/job', async (req, res, next) => {
  try {
    const projectId = validateProjectId(req.params.id);
    const [jobs] = await pool.query(
      'SELECT * FROM analysis_jobs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1',
      [projectId]
    );
    if (!jobs.length) {
      const err = new Error('Analysis job not found.');
      err.statusCode = 404;
      throw err;
    }
    res.json(jobs[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const projectId = validateProjectId(req.params.id);
    const relPath = requireNonEmptyString(req.query?.path, 'path');

    const workspaceBase = path.resolve(env.uploadDir, projectId);
    let candidate = path.resolve(workspaceBase, relPath);

    if (!candidate.startsWith(workspaceBase + path.sep)) {
      const err = new Error('Access denied: invalid file path.');
      err.statusCode = 403;
      throw err;
    }

    try {
      await fs.access(candidate);
    } catch {
      const entries = await fs.readdir(workspaceBase, { withFileTypes: true });
      const subDir = entries.find((e) => e.isDirectory() && e.name !== '__MACOSX');
      if (subDir) {
        const nestedCandidate = path.resolve(workspaceBase, subDir.name, relPath);
        if (nestedCandidate.startsWith(workspaceBase + path.sep)) {
          candidate = nestedCandidate;
        }
      }
    }

    const content = await fs.readFile(candidate, 'utf-8');
    res.json({ path: relPath, content });
  } catch (err) {
    if (err.code === 'ENOENT') {
      err.statusCode = 404;
      err.message = 'File not found in workspace.';
    }
    next(err);
  }
});

router.post('/:id/chat', aiRateLimiter, async (req, res, next) => {
  try {
    const projectId = validateProjectId(req.params.id);
    const question = requireNonEmptyString(req.body?.question, 'question');
    const message = await askAssistant(projectId, question);
    res.json(message);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const projectId = validateProjectId(req.params.id);
    await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);
    await ChunkMetadata.deleteMany({ projectId });
    await Summary.deleteOne({ projectId });
    await OnboardingGuide.deleteOne({ projectId });
    await ChatHistory.deleteMany({ projectId });

    try {
      await chromaClient.deleteCollection({ name: getProjectCollectionName(projectId) });
    } catch {
      // Collection may not exist yet
    }

    const workspaceDir = path.resolve(env.uploadDir, projectId);
    await fs.rm(workspaceDir, { recursive: true, force: true });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
