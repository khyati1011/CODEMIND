import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getProjectFile } from '../api/client.js';
import FileTree from '../components/FileTree.jsx';

export default function CodeExplorerPage({ projectId, detail, selectedFile, highlightRange, onSelectFile }) {
  const files = detail.files || [];
  const fileTree = detail.summary?.fileTree || {};
  const activePath = selectedFile || files[0]?.file_path || '';

  const [filterText, setFilterText] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    getProjectFile(projectId, activePath)
      .then((res) => {
        if (!cancelled) setContent(res.content);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, activePath]);

  const activeMeta = files.find((f) => f.file_path === activePath);
  const symbols = activeMeta?.symbols_json || [];
  const imports = activeMeta?.imports_json || [];
  const exportsList = activeMeta?.exports_json || [];

  const filteredFiles = filterText.trim()
    ? files.filter((f) => f.file_path.toLowerCase().includes(filterText.trim().toLowerCase()))
    : null;

  return (
    <div className="grid h-[680px] gap-4 lg:grid-cols-12">
      {/* Left: File Tree / Filter */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 lg:col-span-3">
        <div className="border-b border-slate-800 p-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter files..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredFiles ? (
            <div className="space-y-0.5">
              {filteredFiles.map((f) => (
                <button
                  key={f.file_path}
                  type="button"
                  onClick={() => onSelectFile(f.file_path)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left font-mono text-xs ${
                    activePath === f.file_path
                      ? 'bg-teal-500/15 text-teal-300'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{f.file_path}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-slate-500 tabular-nums">{f.lines_count}L</span>
                </button>
              ))}
              {filteredFiles.length === 0 && (
                <p className="px-2 py-4 text-xs text-slate-500">No files match &ldquo;{filterText}&rdquo;.</p>
              )}
            </div>
          ) : (
            <FileTree fileTree={fileTree} selectedPath={activePath} onSelectFile={(path) => onSelectFile(path)} />
          )}
        </div>
      </section>

      {/* Center: Code Viewer */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 lg:col-span-6">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <span className="truncate font-mono text-xs font-medium text-teal-300">
            {activePath || 'Select a file'}
          </span>
          {activeMeta && (
            <span className="shrink-0 text-xs text-slate-400 tabular-nums">
              {activeMeta.language} · {activeMeta.lines_count} lines
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
          {loading ? (
            <p className="p-2 text-slate-400">Loading source file...</p>
          ) : error ? (
            <p className="p-2 text-red-400">{error}</p>
          ) : (
            <pre>
              {content.split('\n').map((line, idx) => {
                const lineNumber = idx + 1;
                const isHighlighted =
                  highlightRange &&
                  lineNumber >= highlightRange.startLine &&
                  lineNumber <= highlightRange.endLine;
                return (
                  <div
                    key={lineNumber}
                    className={`flex gap-4 px-2 ${
                      isHighlighted ? 'bg-teal-500/15 text-white' : 'hover:bg-slate-900'
                    }`}
                  >
                    <span className="w-9 shrink-0 select-none text-right text-slate-600 tabular-nums">
                      {lineNumber}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </section>

      {/* Right: AST Symbols, Imports & Exports */}
      <section className="flex flex-col overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-3">
        <h2 className="text-xs font-semibold text-white">Extracted Symbols ({symbols.length})</h2>
        <div className="mt-2.5 space-y-1.5">
          {symbols.length === 0 ? (
            <p className="text-xs text-slate-500">No functions or classes extracted for this file.</p>
          ) : (
            symbols.map((sym, i) => (
              <button
                key={`${sym.name}-${i}`}
                type="button"
                onClick={() =>
                  onSelectFile(activePath, { startLine: sym.startLine, endLine: sym.endLine })
                }
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left transition-colors hover:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-slate-100">{sym.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                    {sym.kind} · lines {sym.startLine}–{sym.endLine}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <h3 className="text-xs font-semibold text-white">Imports ({imports.length})</h3>
          {imports.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">None</p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-xs text-slate-300">
              {imports.map((imp, idx) => (
                <li key={idx} className="truncate">
                  {imp}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="text-xs font-semibold text-white">Exports ({exportsList.length})</h3>
          {exportsList.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">None</p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-xs text-slate-300">
              {exportsList.map((exp, idx) => (
                <li key={idx} className="truncate">
                  {exp}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
