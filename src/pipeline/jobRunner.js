import { pool } from '../config/mysql.js';
import { Summary } from '../models/Summary.js';
import { scanWorkspace } from '../scanner/index.js';
import { analyzeSourceCode } from '../analyzer/index.js';
import { buildDependencyGraph } from '../graph/index.js';
import { indexProjectCodebase } from '../indexing/index.js';
import { generateOnboarding } from '../onboarding/index.js';

export async function updateJob(jobId, status, progress, currentStage, errorMessage = null) {
  const finishedClause =
    status === 'completed' || status === 'failed' ? ', finished_at = CURRENT_TIMESTAMP' : '';
  await pool.query(
    `UPDATE analysis_jobs SET status = ?, progress = ?, current_stage = ?, error_message = ?${finishedClause} WHERE id = ?`,
    [status, progress, currentStage, errorMessage, jobId]
  );
}

export async function runAnalysisJob({ jobId, projectId, projectName, rootDir }) {
  try {
    await updateJob(jobId, 'scanning', 20, 'Scanning directories and detecting languages');
    const scanResult = await scanWorkspace(rootDir);
    if (!scanResult.files.length) {
      throw new Error('No supported source or configuration files found.');
    }

    await updateJob(jobId, 'parsing', 40, 'Parsing source files with Tree-sitter');
    const analysisMap = new Map();
    let totalLines = 0;
    let totalSymbols = 0;

    for (const file of scanResult.files) {
      totalLines += file.linesCount;
      const analysis = analyzeSourceCode(file.content, file.language);
      analysisMap.set(file.path, analysis);
      totalSymbols += analysis.symbols.length;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM file_metadata WHERE project_id = ?', [projectId]);
      for (const file of scanResult.files) {
        const analysis = analysisMap.get(file.path);
        await conn.query(
          `INSERT INTO file_metadata (project_id, file_path, directory, language, lines_count, size_bytes, symbol_count, symbols_json, imports_json, exports_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            file.path,
            file.directory,
            file.language,
            file.linesCount,
            file.sizeBytes,
            analysis.symbols.length,
            JSON.stringify(analysis.symbols),
            JSON.stringify(analysis.imports),
            JSON.stringify(analysis.exports),
          ]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await updateJob(jobId, 'graphing', 55, 'Building module dependency graph with Graphology');
    const graphData = buildDependencyGraph(scanResult.files, analysisMap);

    await Summary.findOneAndUpdate(
      { projectId },
      {
        projectId,
        fileTree: scanResult.fileTree,
        graph: {
          nodes: graphData.nodes,
          edges: graphData.edges,
          rankings: graphData.rankings,
        },
      },
      { upsert: true }
    );

    await updateJob(jobId, 'indexing', 75, 'Chunking symbols, generating embeddings & storing in ChromaDB');
    await indexProjectCodebase(projectId, scanResult.files, analysisMap);

    await updateJob(jobId, 'onboarding', 90, 'Generating project overview and onboarding guide');
    await generateOnboarding({
      projectId,
      projectName,
      files: scanResult.files,
      graphData,
      languageCounts: scanResult.languageCounts,
    });

    await pool.query(
      `UPDATE projects SET total_files = ?, total_lines = ?, total_symbols = ?, languages_json = ? WHERE id = ?`,
      [scanResult.files.length, totalLines, totalSymbols, JSON.stringify(scanResult.languageCounts), projectId]
    );

    await updateJob(jobId, 'completed', 100, 'Analysis completed');
  } catch (err) {
    console.error(`[Job ${jobId}] Failed:`, err);
    await updateJob(jobId, 'failed', 100, 'Analysis failed', err.message);
  }
}
