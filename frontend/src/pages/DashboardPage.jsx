import React from 'react';
import FileTree from '../components/FileTree.jsx';

export default function DashboardPage({ detail, onOpenFile }) {
  const { project, summary } = detail;
  const languages = project.languages_json || {};
  const edgeCount = summary?.graph?.edges?.length || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCell label="Scanned Files" value={project.total_files || 0} />
        <MetricCell label="Lines of Code" value={project.total_lines || 0} />
        <MetricCell label="AST Symbols" value={project.total_symbols || 0} />
        <MetricCell label="Dependency Links" value={edgeCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Project Summary</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              {summary?.projectSummary || 'Summary will appear once repository analysis finishes.'}
            </p>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Language Breakdown</h2>
            {Object.keys(languages).length === 0 ? (
              <p className="text-xs text-slate-500">No language statistics available yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(languages)
                  .sort(([, a], [, b]) => b - a)
                  .map(([lang, count]) => {
                    const pct = project.total_files ? Math.round((count / project.total_files) * 100) : 0;
                    return (
                      <div key={lang}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-200">{lang}</span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            {count} files · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>

        <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">File Tree</h2>
            <span className="text-xs text-slate-500 tabular-nums">{project.total_files || 0} items</span>
          </div>
          <div className="max-h-[420px] flex-1 overflow-y-auto pr-1">
            <FileTree fileTree={summary?.fileTree} selectedPath="" onSelectFile={(path) => onOpenFile(path)} />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCell({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
        {Number(value).toLocaleString()}
      </p>
    </div>
  );
}
