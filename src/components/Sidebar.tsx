import { FolderPlus, Trash2, BookOpen, LayoutDashboard, Code2, GitFork, MessageSquare } from 'lucide-react';
import type { ProjectListItem } from '../types.ts';

export type PageId = 'upload' | 'dashboard' | 'explorer' | 'graph' | 'chat' | 'onboarding';

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'explorer', label: 'Code Explorer', icon: Code2 },
  { id: 'graph', label: 'Dependency Graph', icon: GitFork },
  { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
  { id: 'onboarding', label: 'Onboarding Guide', icon: BookOpen },
];

interface SidebarProps {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export default function Sidebar({
  projects,
  activeProjectId,
  activePage,
  onSelectPage,
  onSelectProject,
  onDeleteProject,
}: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">CODEMIND</span>
        <button
          type="button"
          onClick={() => onSelectPage('upload')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400 whitespace-nowrap shrink-0"
        >
          <FolderPlus size={14} />
          New
        </button>
      </div>

      <nav className="border-b border-slate-800 px-3 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const disabled = !activeProjectId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPage(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-teal-400'
                  : disabled
                  ? 'cursor-not-allowed text-slate-600'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col overflow-hidden px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold text-slate-400">Repositories</p>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-500">No repositories analyzed yet.</p>
          ) : (
            projects.map((p) => {
              const isSelected = p.id === activeProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    if (activePage === 'upload') onSelectPage('dashboard');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectProject(p.id);
                      if (activePage === 'upload') onSelectPage('dashboard');
                    }
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-teal-500/10 text-teal-300'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {p.job_status || 'queued'} · {p.total_files || 0} files
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(p.id);
                    }}
                    className="rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-slate-800 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
