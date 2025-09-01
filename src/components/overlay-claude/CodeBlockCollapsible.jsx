import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Persist collapse state per text hash to avoid flicker on re-renders
const collapsedStore = new Map();

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}

export default function CodeBlockCollapsible({ language, text }) {
  const [copied, setCopied] = useState(false);
  const src = String(text);
  const lines = src.split('\n');
  const lineCount = lines.length;
  const key = useMemo(() => `claude:${hash(src)}`, [src]);
  const [collapsed, setCollapsed] = useState(() => {
    return collapsedStore.has(key) ? !!collapsedStore.get(key) : (lineCount > 12);
  });
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  const toggle = () => {
    const next = !collapsed;
    collapsedStore.set(key, next);
    setCollapsed(next);
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
      <div className="flex items-center justify-between gap-2 mb-1 px-2 py-1 rounded-md border border-border/20 bg-transparent w-full">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 text-left cursor-pointer">
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {headerTitle ? (
            <span className="font-mono text-[11px] truncate block">{headerTitle}</span>
          ) : (
            <span className="font-mono text-[11px] truncate block">{language || 'text'} • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
          )}
        </button>
        <button onClick={handleCopy} className="px-2 py-0.5 text-[11px] rounded-md border border-border/40 bg-transparent hover:bg-accent/40 flex-shrink-0">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {!collapsed && (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: '0',
            borderRadius: '0 0 0.5rem 0.5rem',
            fontSize: '0.85rem',
            width: '100%',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '60vh',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {String(text).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )}
    </div>
  );
}
