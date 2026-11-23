import { useEffect, useState } from 'react';
import { deleteProject, getProjectDetail, listProjects } from './api/client.ts';
import Sidebar, { type PageId } from './components/Sidebar.tsx';
import JobStatusBanner from './components/JobStatusBanner.tsx';
import UploadPage from './pages/UploadPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import CodeExplorerPage from './pages/CodeExplorerPage.tsx';
import DependencyGraphPage from './pages/DependencyGraphPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import OnboardingPage from './pages/OnboardingPage.tsx';
import type { LineRange, ProjectDetail, ProjectListItem } from './types.ts';

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [highlightRange, setHighlightRange] = useState<LineRange | null>(null);
  const [loadError, setLoadError] = useState('');

  async function refreshProjects(selectId: string | null = null) {
    try {
      const rows = await listProjects();
      setProjects(rows);
      if (selectId) {
        setActiveProjectId(selectId);
      } else if (!activeProjectId && rows.length > 0) {
        setActiveProjectId(rows[0].id);
        setActivePage('dashboard');
      } else if (rows.length === 0) {
        setActivePage('upload');
      }
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadDetail() {
      if (!activeProjectId) return;
      try {
        const data = await getProjectDetail(activeProjectId);
        if (cancelled) return;
        setDetail(data);
        setLoadError('');

        const status = data.job?.status;
        if (status && status !== 'completed' && status !== 'failed') {
          pollTimer = setTimeout(loadDetail, 1800);
        } else {
          const rows = await listProjects();
          if (!cancelled) setProjects(rows);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [activeProjectId]);

  function handleProjectCreated(newId: string) {
    setSelectedFile('');
    setHighlightRange(null);
    refreshProjects(newId);
    setActivePage('dashboard');
  }

  async function handleDeleteProject(projectId: string) {
    await deleteProject(projectId);
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setDetail(null);
      setActivePage('upload');
    }
    await refreshProjects();
  }

  function handleOpenFile(filePath: string, range: LineRange | null = null) {
    setSelectedFile(filePath);
    setHighlightRange(range);
    setActivePage('explorer');
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        activePage={activePage}
        onSelectPage={setActivePage}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setSelectedFile('');
          setHighlightRange(null);
        }}
        onDeleteProject={handleDeleteProject}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-8 border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {activePage === 'upload'
                ? 'New Repository Analysis'
                : detail?.project?.name || 'Workspace'}
            </p>
            {activePage !== 'upload' && detail?.project && (
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {detail.project.source_type.toUpperCase()}
                {detail.project.source_url ? ` · ${detail.project.source_url}` : ''}
                {detail.project.default_branch ? ` · ${detail.project.default_branch}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActivePage('upload')}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap shrink-0"
          >
            Connect Repository
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {loadError && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-xs text-red-300">
                {loadError}
              </div>
            )}

            {activePage === 'upload' && <UploadPage onProjectCreated={handleProjectCreated} />}

            {activePage !== 'upload' && detail && (
              <>
                <JobStatusBanner job={detail.job} />

                {activePage === 'dashboard' && (
                  <DashboardPage detail={detail} onOpenFile={(path) => handleOpenFile(path)} />
                )}
                {activePage === 'explorer' && (
                  <CodeExplorerPage
                    projectId={detail.project.id}
                    detail={detail}
                    selectedFile={selectedFile}
                    highlightRange={highlightRange}
                    onSelectFile={handleOpenFile}
                  />
                )}
                {activePage === 'graph' && (
                  <DependencyGraphPage
                    graph={detail.summary?.graph}
                    onInspectFile={(path) => handleOpenFile(path)}
                  />
                )}
                {activePage === 'chat' && (
                  <ChatPage
                    projectId={detail.project.id}
                    initialMessages={detail.chatHistory}
                    onOpenCitation={handleOpenFile}
                  />
                )}
                {activePage === 'onboarding' && (
                  <OnboardingPage
                    onboarding={detail.onboarding}
                    onOpenFile={(path) => handleOpenFile(path)}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
