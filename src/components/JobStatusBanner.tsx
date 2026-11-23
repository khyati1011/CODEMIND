import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ProjectDetail } from '../types.ts';

export default function JobStatusBanner({ job }: { job: ProjectDetail['job'] }) {
  if (!job) return null;

  if (job.status === 'completed') {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
        <div className="flex items-center gap-2.5 text-emerald-400">
          <CheckCircle2 size={16} />
          <span className="font-medium text-slate-200">{job.current_stage || 'Analysis completed'}</span>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">100%</span>
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        <div className="flex items-center gap-2 font-semibold text-red-400">
          <AlertCircle size={16} />
          <span>Analysis job failed</span>
        </div>
        <p className="mt-1 text-xs text-red-300">{job.error_message || 'Unknown pipeline error.'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2.5 text-teal-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-medium text-slate-100">{job.current_stage || 'Processing repository'}</span>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">{job.progress || 0}%</span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(5, job.progress || 0))}%` }}
        />
      </div>
    </div>
  );
}
