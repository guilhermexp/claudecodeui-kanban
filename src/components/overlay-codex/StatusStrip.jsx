import React, { useState } from 'react';

export default function StatusStrip({
  projectPath,
  plannerMode,
  onPlannerChange,
  modelLabel,
  onModelChange,
  working
}) {
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const projectLabel = projectPath ? projectPath.split('/').pop() : 'Local';

  return (
    <div className="flex items-center justify-between text-muted-foreground text-xs px-2 mb-2">
      <div className="flex items-center gap-3">
        {working?.active && (
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="relative flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="whitespace-nowrap">{working.label} • {Math.max(0, working.elapsedSec || 0)}s</span>
          </span>
        )}

        <button className="flex items-center gap-1 hover:text-foreground transition-colors" title={projectPath || 'Current directory'}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          <span className="max-w-[200px] truncate">{projectLabel}</span>
        </button>

        <div className="relative">
          <button onClick={() => { setShowModeMenu(v => !v); setShowModelMenu(false); }} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M12 2v6m0 8v6m10-10h-6m-8 0H2"/></svg>
            <span>{plannerMode === 'Planer' ? 'Planner' : plannerMode}</span>
          </button>
          {showModeMenu && (
            <div className="absolute z-50 bottom-full mb-1 left-0 w-24 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
              {['Auto','Planer','Chat'].map(m => (
                <button key={m} onClick={() => { onPlannerChange?.(m); setShowModeMenu(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${m===plannerMode?'text-zinc-300 bg-zinc-800/50':'text-zinc-500'}`}>
                  {m === 'Planer' ? 'Planner' : m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setShowModelMenu(v => !v); setShowModeMenu(false); }} className="flex items-center gap-1 hover:text-foreground transition-colors" title="Model">
            <span>Model:</span>
            <span className="font-medium">{modelLabel}</span>
          </button>
          {showModelMenu && (
            <div className="absolute z-50 bottom-full mb-1 left-0 w-36 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
              {['Full Access','Standard','Lite'].map(m => (
                <button key={m} onClick={() => { onModelChange?.(m); setShowModelMenu(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${m===modelLabel?'text-zinc-300 bg-zinc-800/50':'text-zinc-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

