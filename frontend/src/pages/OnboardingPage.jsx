import React from 'react';

export default function OnboardingPage({ onboarding, onOpenFile }) {
  if (!onboarding) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
        Onboarding guide will be generated once the analysis job completes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-2 text-sm font-semibold text-white">Architecture Overview</h2>
        <p className="text-sm leading-relaxed text-slate-300">{onboarding.overview}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Setup Steps</h2>
          <ol className="space-y-3">
            {(onboarding.setupSteps || []).map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-sm text-slate-200"
              >
                <span className="font-mono text-xs font-semibold text-teal-400 tabular-nums">
                  {String(i + 1).padStart(2, '0')}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Suggested Reading Order</h2>
          <div className="space-y-3">
            {(onboarding.readingOrder || []).map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenFile(item.filePath)}
                    className="truncate text-left font-mono text-xs font-semibold text-teal-400 hover:underline"
                  >
                    {item.step}. {item.filePath}
                  </button>
                  <span className="shrink-0 text-xs text-slate-400">{item.role}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {onboarding.keyModules?.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Key Modules</h2>
          <div className="divide-y divide-slate-800">
            {onboarding.keyModules.map((mod, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenFile(mod.filePath)}
                    className="font-mono text-xs font-semibold text-teal-400 hover:underline"
                  >
                    {mod.filePath}
                  </button>
                  <p className="mt-1 text-xs text-slate-400">{mod.purpose}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
                  centrality {mod.centrality ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
