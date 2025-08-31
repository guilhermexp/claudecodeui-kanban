import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodeBlockCollapsible({ language, text }) {
  const [copied, setCopied] = useState(false);
  const src = String(text);
  const lines = src.split('\n');
  const lineCount = lines.length;
  const [collapsed, setCollapsed] = useState(lineCount > 12);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  const headerTitle = (() => {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const l = (lines[i] || '').trim();
      if (!l) continue;
      if (/^(PS\s|>|\$\s)/.test(l)) continue;
      if (l.length > 80) continue;
      if (/^[a-zA-Z0-9_.\/-]+(\s+[^\n]{0,60})?$/.test(l)) return l;
      break;
    }
    return null;
  })();
  return (
    <div className="relative group w-full max-w-full">
      <div className="flex items-center justify-between gap-2 mb-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-border/50 bg-transparent w-full">
        <button type="button" onClick={() => setCollapsed(prev => !prev)} aria-expanded={!collapsed} className="flex items-center gap-2 text-[12px] sm:text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 text-left cursor-pointer">
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {headerTitle ? (
            <span className="font-mono text-[11px] sm:text-xs truncate block">{headerTitle}</span>
          ) : (
            <span className="font-mono text-[11px] sm:text-xs truncate block">{language || 'text'} • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
          )}
        </button>
        <button onClick={handleCopy} className="px-2 py-1 text-[11px] rounded-md bg-background/80 border border-border hover:bg-accent flex-shrink-0">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {!collapsed && (
        <SyntaxHighlighter style={vscDarkPlus} language={language} PreTag="div" customStyle={{ margin: '0', borderRadius: '0 0 0.5rem 0.5rem', fontSize: '0.85rem', width: '100%', overflowX: 'auto' }}>
          {String(text).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )}
    </div>
  );
}

