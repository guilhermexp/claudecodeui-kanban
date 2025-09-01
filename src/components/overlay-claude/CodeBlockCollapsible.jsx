import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme?.() || { theme: 'dark' };
  const codeStyle = theme === 'light' ? oneLight : vscDarkPlus;
  const [copied, setCopied] = useState(false);
  const src = String(text);
  const lines = src.split('\n');
  const lineCount = lines.length;
  const key = useMemo(() => `claude:${hash(src)}`, [src]);
  const [collapsed, setCollapsed] = useState(() => {
    // Always start collapsed by default; persist last state per block
    return collapsedStore.has(key) ? !!collapsedStore.get(key) : true;
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
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-white/10 bg-black/20 backdrop-blur-sm w-full">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white transition-colors min-w-0 flex-1 text-left cursor-pointer">
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {headerTitle ? (
            <span className="font-mono text-[11px] truncate block text-zinc-200">{headerTitle}</span>
          ) : (
            <span className="font-mono text-[11px] truncate block text-zinc-400">{language || 'text'} • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
          )}
        </button>
        <button onClick={handleCopy} className="px-2 py-0.5 text-[11px] rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-zinc-200 flex-shrink-0">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {!collapsed && (
        <SyntaxHighlighter
          style={codeStyle}
          language={language}
          PreTag="div"
          wrapLongLines
          customStyle={{
            margin: '0',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            width: '100%',
            overflowX: 'hidden',
            overflowY: 'auto',
            maxHeight: '60vh',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
          }}
        >
          {String(text).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )}
    </div>
  );
}
