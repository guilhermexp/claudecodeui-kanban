import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodeBlockCollapsible({ language, text }) {
  const [copied, setCopied] = React.useState(false);
  const [wrap, setWrap] = React.useState(true);
  const src = String(text || '');
  const lines = src.split('\n');
  const lineCount = lines.length;
  const [collapsed, setCollapsed] = React.useState(lineCount > 12);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(src); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };

  // Remove common leading indentation so content adheres to left edge
  const deindented = React.useMemo(() => {
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    const indent = nonEmpty.length ? Math.min(...nonEmpty.map(l => (l.match(/^\s*/)?.[0] || '').length)) : 0;
    if (indent > 0) return lines.map(l => l.slice(indent)).join('\n');
    return src;
  }, [src]);

  return (
    <div className="w-full max-w-full">
      <div className="flex items-center justify-between gap-2 px-1.5 sm:px-2 py-1">
        <button
          type="button"
          onClick={() => setCollapsed(prev => !prev)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-[12px] sm:text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 text-left cursor-pointer"
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-mono text-[11px] sm:text-xs truncate block">{language || 'text'} • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWrap(w => !w)}
            className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-accent/20 flex-shrink-0 bg-transparent"
            title={wrap ? 'Disable wrap' : 'Enable wrap'}
          >{wrap ? 'Wrap' : 'No-wrap'}</button>
          <button onClick={handleCopy} className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-accent/20 flex-shrink-0 bg-transparent">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="w-full">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '12px 14px',
              background: 'transparent',
              fontSize: '0.9rem',
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              wordBreak: wrap ? 'break-word' : 'normal',
              overflowX: 'hidden',
              overflowY: 'auto',
              maxHeight: '60vh'
            }}
          >
            {deindented.replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

