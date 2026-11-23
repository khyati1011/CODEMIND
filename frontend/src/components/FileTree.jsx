import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';

function TreeNode({ name, node, depth, selectedPath, onSelectFile }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === 'file') {
    const isSelected = selectedPath === node.path;
    return (
      <button
        type="button"
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`flex w-full items-center justify-between rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
          isSelected
            ? 'bg-teal-500/15 font-medium text-teal-300'
            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <FileText size={13} className="shrink-0 text-slate-400" />
          <span className="truncate font-mono">{name}</span>
        </span>
        <span className="ml-2 shrink-0 text-[11px] text-slate-500 tabular-nums">{node.linesCount}L</span>
      </button>
    );
  }

  const children = Object.entries(node.children || {}).sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return 0;
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
      >
        {expanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
        <Folder size={13} className="shrink-0 text-teal-400/80" />
        <span className="truncate font-mono">{name}</span>
      </button>
      {expanded && (
        <div>
          {children.map(([childName, childNode]) => (
            <TreeNode
              key={childName}
              name={childName}
              node={childNode}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ fileTree, selectedPath, onSelectFile }) {
  const entries = Object.entries(fileTree || {}).sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return 0;
  });

  if (entries.length === 0) {
    return <p className="px-3 py-4 text-xs text-slate-500">No files available in repository tree.</p>;
  }

  return (
    <div className="space-y-0.5">
      {entries.map(([name, node]) => (
        <TreeNode
          key={name}
          name={name}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}
