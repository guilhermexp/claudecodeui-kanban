import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function createMarkdownComponents() {
  return {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      // Code block with language: collapsible + copy
      if (!inline && language) {
        const CodeWithCopy = ({ text }) => {
          const [copied, setCopied] = useState(false);
          const [collapsed, setCollapsed] = useState(true);
          const handleCopy = async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
          };
          const lines = String(text).split('\n');
          const lineCount = lines.length;
          const preview = lines.slice(0, 3).join('\n');
          return (
            <div className="relative group w-full -mx-2 sm:-mx-3">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20 rounded-t-md bg-zinc-950/70 border border-border/30">
                <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono text-[11px]">{language} • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
                </button>
                <button onClick={handleCopy} className="px-2 py-0.5 text-[11px] rounded-md border border-border/40 bg-transparent hover:bg-accent/40">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              {collapsed ? (
                <div className="px-3 py-2 bg-zinc-950/50 rounded-b-md border border-t-0 border-border/30">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words overflow-auto">
                    <code>{preview}{lineCount > 3 ? '\n...' : ''}</code>
                  </pre>
                </div>
              ) : (
                <div className="border border-t-0 border-border/30 rounded-b-md overflow-hidden">
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={language}
                    PreTag="div"
                    customStyle={{ margin: 0, fontSize: '0.9rem', width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', background: 'transparent', padding: '12px 14px' }}
                    {...props}
                  >
                    {String(text).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          );
        };
        return <CodeWithCopy text={String(children)} />;
      }
      // Multiline code block without language: collapsible minimal block
      if (!inline) {
        const text = String(children || '');
        // Persist collapse per text
        const collapsedStore = (createMarkdownComponents.__collapsedStore ||= new Map());
        const hash = (s) => { let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=(h*16777619)>>>0;} return h.toString(36); };
        const key = 'plain:'+hash(text);
        const CollapsiblePlain = () => {
          const [copied, setCopied] = useState(false);
          const [collapsed, setCollapsed] = useState(() => collapsedStore.has(key) ? !!collapsedStore.get(key) : true);
          const lines = text.split('\n');
          const lineCount = lines.length;
          const preview = lines.slice(0, 3).join('\n');
          const handleCopy = async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
          };
          return (
            <div className="relative group w-full -mx-2 sm:-mx-3">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20 rounded-t-md bg-zinc-950/70 border border-border/30">
                <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono text-[11px]">text • {lineCount} {collapsed ? 'lines (click to expand)' : 'lines'}</span>
                </button>
                <button onClick={handleCopy} className="px-2 py-0.5 text-[11px] rounded-md border border-border/40 bg-transparent hover:bg-accent/40">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              {collapsed ? (
                <div className="px-3 py-2 bg-zinc-950/50 rounded-b-md border border-t-0 border-border/30">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words overflow-auto">
                    {preview}{lineCount > 3 ? '\n...' : ''}
                  </pre>
                </div>
              ) : (
                <pre className="w-full border border-t-0 border-border/30 rounded-b-md p-3 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words overflow-auto bg-zinc-950/50 max-h-[60vh]">
                  {text}
                </pre>
              )}
            </div>
          );
        };
        return <CollapsiblePlain />;
      }
      // Inline code
      return (<code className="chat-inline-code" {...props}>{children}</code>);
    },
    a({ children, href, ...props }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props}>{children}</a>
      );
    },
    ul({ children, ...props }) {
      return (<ul className="list-disc list-outside pl-4 ml-0 my-2" {...props}>{children}</ul>);
    },
    ol({ children, ...props }) {
      return (<ol className="list-decimal list-outside pl-4 ml-0 my-2" {...props}>{children}</ol>);
    },
    blockquote({ children, ...props }) {
      return (<blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground" {...props}>{children}</blockquote>);
    },
    h1({ children, ...props }) { return <h1 className="text-xl font-bold mt-3 mb-2" {...props}>{children}</h1>; },
    h2({ children, ...props }) { return <h2 className="text-lg font-semibold mt-2 mb-1" {...props}>{children}</h2>; },
    h3({ children, ...props }) { return <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>; },
    p({ children, ...props }) {
      const renderBadges = (content) => {
        try {
          const text = String(content || '');
          const pieces = [];
          let rest = text;
          const badge = (cls, label) => <span className={`badge ${cls}`}>{label}</span>;
          if (/^(JS|TS|MD|JSON)\s+/.test(rest)) { const m = /^(JS|TS|MD|JSON)\s+/.exec(rest); const kind = m[1]; pieces.push(badge(`badge-${kind.toLowerCase()}`, kind)); rest = rest.slice(m[0].length); }
          if (/\sMODIFY\b/.test(rest)) { const idx = rest.lastIndexOf(' MODIFY'); const before = rest.slice(0, idx); const after = rest.slice(idx + 1); pieces.push(<span key="before"> {before} </span>); pieces.push(badge('badge-modify', 'MODIFY')); const tail = after.replace(/^MODIFY\b\s*/, ''); if (tail) pieces.push(<span key="tail"> {tail} </span>); return pieces; }
          if (/^References\b/.test(rest)) { pieces.push(badge('badge-ref', 'References')); const tail = rest.replace(/^References\b\s*/, ''); if (tail) pieces.push(<span key="tail"> {tail} </span>); return pieces; }
          return text;
        } catch { return children; }
      };
      if (typeof children === 'string') return <p className="my-1" {...props}>{renderBadges(children)}</p>;
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') return <p className="my-1" {...props}>{renderBadges(children[0])}</p>;
      return <p className="my-1" {...props}>{children}</p>;
    },
    li({ children, ...props }) {
      const raw = String(children && children[0] ? (children[0].props ? children[0].props.children : children[0]) : '');
      const renderBadges = (text) => {
        const parts = [];
        const badge = (cls, label) => <span className={`badge ${cls}`}>{label}</span>;
        let rest = text;
        if (/^(JS|TS|MD|JSON)\s+/.test(rest)) { const m = /^(JS|TS|MD|JSON)\s+/.exec(rest); const kind = m[1]; parts.push(badge(`badge-${kind.toLowerCase()}`, kind)); rest = rest.slice(m[0].length); }
        if (/^References\b/.test(rest)) { parts.push(badge('badge-ref', 'References')); rest = rest.replace(/^References\b\s*/, ''); }
        if (/\sMODIFY\b/.test(rest)) { const idx = rest.lastIndexOf(' MODIFY'); const before = rest.slice(0, idx); parts.push(<span key="before"> {before} </span>); parts.push(badge('badge-modify', 'MODIFY')); const tail = rest.slice(idx + ' MODIFY'.length); if (tail) parts.push(<span key="tail">{tail}</span>); return parts; }
        parts.push(rest); return parts;
      };
      const unchecked = raw.startsWith('[ ] ') || raw.startsWith('[  ] ');
      const checked = raw.startsWith('[x] ') || raw.startsWith('[X] ');
      if (unchecked || checked) {
        const label = raw.replace(/^\[[xX\s]\]\s+/, '');
        return (
          <li className="list-none my-1">
            <label className="inline-flex items-start gap-2">
              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
              <span>{renderBadges(label)}</span>
            </label>
          </li>
        );
      }
      if (typeof children === 'string') return <li className="my-1" {...props}>{renderBadges(children)}</li>;
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') return <li className="my-1" {...props}>{renderBadges(children[0])}</li>;
      return <li className="my-1" {...props}>{children}</li>;
    }
  };
}
