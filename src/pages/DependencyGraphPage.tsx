import { useMemo, useState } from 'react';
import { Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { GraphData, GraphNode } from '../types.ts';

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

interface DependencyGraphPageProps {
  graph?: GraphData;
  onInspectFile: (path: string) => void;
}

export default function DependencyGraphPage({ graph, onInspectFile }: DependencyGraphPageProps) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const rankings = graph?.rankings || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(() => {
    const width = 840;
    const height = 540;
    const cx = width / 2;
    const cy = height / 2;

    const topNodes = [...nodes].sort((a, b) => b.centrality - a.centrality).slice(0, 36);
    const innerRing = topNodes.filter((n) => n.isEntryPoint || n.centrality >= 4).slice(0, 10);
    const innerSet = new Set(innerRing.map((n) => n.id));
    const outerRing = topNodes.filter((n) => !innerSet.has(n.id));

    const posMap = new Map<string, PositionedNode>();

    innerRing.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(innerRing.length, 1);
      const radius = innerRing.length === 1 ? 0 : 115;
      posMap.set(node.id, {
        ...node,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });

    outerRing.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(outerRing.length, 1);
      posMap.set(node.id, {
        ...node,
        x: cx + 215 * Math.cos(angle),
        y: cy + 215 * Math.sin(angle),
      });
    });

    const visibleEdges = edges.filter((e) => posMap.has(e.source) && posMap.has(e.target));
    return { items: Array.from(posMap.values()), posMap, visibleEdges, width, height };
  }, [nodes, edges]);

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;
  const incoming = selectedId ? edges.filter((e) => e.target === selectedId).map((e) => e.source) : [];
  const outgoing = selectedId ? edges.filter((e) => e.source === selectedId).map((e) => e.target) : [];

  const q = searchQuery.trim().toLowerCase();

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Module Dependency Graph</h2>
            <p className="text-xs text-slate-400 tabular-nums">
              {nodes.length} modules · {edges.length} directed import edges
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Highlight module..."
                className="w-44 rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-300 hover:text-white"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-300 hover:text-white"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        {nodes.length === 0 ? (
          <div className="flex h-[500px] items-center justify-center rounded-lg bg-slate-950 text-sm text-slate-500">
            No JavaScript or Python modules available to graph.
          </div>
        ) : (
          <div className="overflow-auto rounded-lg bg-slate-950">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="h-[500px] w-full transition-transform duration-150"
            >
              <defs>
                <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="14" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#14B8A6" opacity="0.65" />
                </marker>
              </defs>

              {layout.visibleEdges.map((edge, idx) => {
                const src = layout.posMap.get(edge.source);
                const tgt = layout.posMap.get(edge.target);
                if (!src || !tgt) return null;
                const active = selectedId && (selectedId === src.id || selectedId === tgt.id);
                return (
                  <line
                    key={idx}
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={active ? '#2DD4BF' : '#334155'}
                    strokeWidth={active ? 2 : 1}
                    markerEnd="url(#dep-arrow)"
                  />
                );
              })}

              {layout.items.map((node) => {
                const radius = Math.min(17, 7 + node.centrality * 1.4);
                const isSelected = selectedId === node.id;
                const matchesSearch = Boolean(q && node.id.toLowerCase().includes(q));
                return (
                  <g key={node.id} onClick={() => setSelectedId(node.id)} className="cursor-pointer">
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={isSelected ? '#14B8A6' : matchesSearch ? '#0D9488' : '#1E293B'}
                      stroke={node.isEntryPoint ? '#2DD4BF' : '#64748B'}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text
                      x={node.x}
                      y={node.y + radius + 12}
                      textAnchor="middle"
                      fill={isSelected || matchesSearch ? '#F8FAFC' : '#94A3B8'}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </section>

      <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-4">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">Selected Module</p>
                <p className="mt-1 break-all font-mono text-xs font-semibold text-teal-300">{selectedNode.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-xs text-slate-400 hover:text-white whitespace-nowrap"
              >
                Back to rankings
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-slate-800 py-3 text-xs tabular-nums">
              <div>
                <p className="text-slate-500">In-Degree</p>
                <p className="mt-0.5 font-mono font-semibold text-white">{selectedNode.inDegree}</p>
              </div>
              <div>
                <p className="text-slate-500">Out-Degree</p>
                <p className="mt-0.5 font-mono font-semibold text-white">{selectedNode.outDegree}</p>
              </div>
              <div>
                <p className="text-slate-500">Centrality</p>
                <p className="mt-0.5 font-mono font-semibold text-white">{selectedNode.centrality}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-300">Imports ({outgoing.length})</p>
              {outgoing.length === 0 ? (
                <p className="text-xs text-slate-500">No internal outgoing imports.</p>
              ) : (
                <div className="space-y-1">
                  {outgoing.map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => setSelectedId(target)}
                      className="block w-full truncate text-left font-mono text-xs text-teal-400 hover:underline"
                    >
                      {target}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-300">Imported By ({incoming.length})</p>
              {incoming.length === 0 ? (
                <p className="text-xs text-slate-500">No internal dependents.</p>
              ) : (
                <div className="space-y-1">
                  {incoming.map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setSelectedId(source)}
                      className="block w-full truncate text-left font-mono text-xs text-slate-300 hover:text-teal-300"
                    >
                      {source}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onInspectFile(selectedNode.id)}
              className="w-full rounded-lg bg-teal-500 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-400"
            >
              Open in Code Explorer
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-white">Entry Points &amp; Central Modules</h3>
            <p className="mt-1 text-xs text-slate-400">Select any module to trace incoming and outgoing links.</p>
            <div className="mt-4 space-y-2">
              {rankings.length === 0 ? (
                <p className="text-xs text-slate-500">No ranked modules available.</p>
              ) : (
                rankings.map((r) => (
                  <button
                    key={r.filePath}
                    type="button"
                    onClick={() => setSelectedId(r.filePath)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-medium text-slate-100">{r.filePath}</span>
                      <span className="shrink-0 font-mono text-xs text-teal-400 tabular-nums">
                        score {r.score}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{r.reason}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
