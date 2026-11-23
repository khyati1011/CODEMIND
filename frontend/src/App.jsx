import React, { useEffect, useState } from 'react';
import { deleteProject, getProjectDetail, listProjects } from './api/client.js';
import Sidebar from './components/Sidebar.jsx';
import JobStatusBanner from './components/JobStatusBanner.jsx';
import UploadPage from './pages/UploadPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CodeExplorerPage from './pages/CodeExplorerPage.jsx';
import DependencyGraphPage from './pages/DependencyGraphPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activePage, setActivePage] = useState('upload');
  const [detail, setDetail] = useState(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [highlightRange, setHighlightRange] = useState(null);
  const [loadError, setLoadError] = useState('');

  async function refreshProjects(selectId = null) {
    try {
      const rows = await listProjects();
      setProjects(rows);
      if (selectId) {
        setActiveProjectId(selectId);
      } else if (!activeProjectId && rows.length > 0) {
        setActiveProjectId(rows[0].id);
        setActivePage('dashboard');
      }
    } catch (err) {
      setLoadError(err.message);
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
    let pollTimer = null;

    async function loadDetail() {
      try {
        const data = await getProjectDetail(activeProjectId);
        if (cancelled) return;
        setDetail(data);
        setLoadError('');

        const status = data.job?.status;
        if (status && status !== 'completed' && status !== 'failed') {
          pollTimer = setTimeout(loadDetail, 2000);
        } else {
          const rows = await listProjects();
          if (!cancelled) setProjects(rows);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [activeProjectId]);

  function handleProjectCreated(newId) {
    setSelectedFile('');
    setHighlightRange(null);
    refreshProjects(newId);
    setActivePage('dashboard');
  }

  async function handleDeleteProject(projectId) {
    await deleteProject(projectId);
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setDetail(null);
      setActivePage('upload');
    }
    await refreshProjects();
  }

  function handleOpenFile(filePath, range = null) {
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
                  <DashboardPage detail={detail} onOpenFile={handleOpenFile} />
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
                    onInspectFile={handleOpenFile}
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
                    onOpenFile={handleOpenFile}
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
