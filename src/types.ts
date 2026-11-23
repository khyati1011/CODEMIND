export interface SymbolEntry {
  name: string;
  kind: 'function' | 'class' | 'method';
  startLine: number;
  endLine: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  source_type: 'zip' | 'github';
  source_url: string | null;
  default_branch: string | null;
  total_files: number;
  total_lines: number;
  total_symbols: number;
  languages_json: Record<string, number>;
  job_status: string;
  job_progress: number;
  current_stage: string;
  error_message: string | null;
}

export interface FileMeta {
  file_path: string;
  directory: string;
  language: string;
  lines_count: number;
  size_bytes: number;
  symbol_count: number;
  symbols_json: SymbolEntry[];
  imports_json: string[];
  exports_json: string[];
}

export interface FileTreeNode {
  type: 'dir' | 'file';
  path?: string;
  language?: string;
  linesCount?: number;
  children?: Record<string, FileTreeNode>;
}

export interface GraphNode {
  id: string;
  label: string;
  language: string;
  linesCount: number;
  inDegree: number;
  outDegree: number;
  centrality: number;
  isEntryPoint: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphRanking {
  filePath: string;
  score: number;
  reason: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rankings: GraphRanking[];
}

export interface ChatSource {
  filePath: string;
  startLine: number;
  endLine: number;
  symbol: string;
  score: number;
  fromGraphNeighbor: boolean;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: ChatSource[];
}

export interface OnboardingGuide {
  overview: string;
  setupSteps: string[];
  keyModules: Array<{ filePath: string; purpose: string; centrality: number }>;
  readingOrder: Array<{ step: number; filePath: string; role: string; rationale: string }>;
}

export interface ProjectDetail {
  project: {
    id: string;
    name: string;
    source_type: 'zip' | 'github';
    source_url: string | null;
    default_branch: string | null;
    total_files: number;
    total_lines: number;
    total_symbols: number;
    languages_json: Record<string, number>;
  };
  job: {
    id: string;
    status: string;
    progress: number;
    current_stage: string;
    error_message: string | null;
  } | null;
  files: FileMeta[];
  summary: {
    projectSummary: string;
    fileTree: Record<string, FileTreeNode>;
    graph: GraphData;
  } | null;
  onboarding: OnboardingGuide | null;
  chatHistory: ChatMessage[];
}

export interface LineRange {
  startLine: number;
  endLine: number;
}
