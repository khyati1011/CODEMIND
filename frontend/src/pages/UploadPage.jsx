import React, { useState } from 'react';
import { Github, Upload } from 'lucide-react';
import { ingestGithubRepository, ingestZipArchive } from '../api/client.js';

export default function UploadPage({ onProjectCreated }) {
  const [sourceMode, setSourceMode] = useState('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [zipFile, setZipFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const created =
        sourceMode === 'github'
          ? await ingestGithubRepository(repoUrl, projectName)
          : await ingestZipArchive(zipFile, projectName);

      onProjectCreated(created.projectId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Connect a Repository</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Provide a public GitHub repository URL or upload a ZIP archive. CODEMIND scans JavaScript and Python files,
          parses AST structures with Tree-sitter, builds a Graphology dependency map, and indexes symbols into ChromaDB.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => {
              setSourceMode('github');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              sourceMode === 'github' ? 'bg-slate-800 text-teal-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Github size={16} />
            GitHub Repository
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceMode('zip');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              sourceMode === 'zip' ? 'bg-slate-800 text-teal-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload size={16} />
            ZIP Archive
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-slate-300">
              Project Name (optional)
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Defaults to repository or archive name"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </div>

          {sourceMode === 'github' ? (
            <div>
              <label htmlFor="repo-url" className="mb-1.5 block text-xs font-medium text-slate-300">
                Public GitHub URL
              </label>
              <input
                id="repo-url"
                type="url"
                required
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/expressjs/express"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="zip-upload" className="mb-1.5 block text-xs font-medium text-slate-300">
                Repository Archive (.zip, max 25 MB)
              </label>
              <input
                id="zip-upload"
                type="file"
                accept=".zip"
                required
                onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-teal-400 hover:file:bg-slate-700"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Binaries, .env secrets, and node_modules are filtered automatically.
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Starting Analysis...' : 'Analyze Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
