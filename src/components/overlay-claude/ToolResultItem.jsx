import React, { useState, useMemo } from 'react';
// Minimal tool output block: header row + collapsible raw text

export default function ToolResultItem({ action = 'Executed', filePath = '', content, icon, details, language = 'bash', showMeta = true, error = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const shortenTail = (path, keep = 2) => {
    try {
      const parts = String(path || '').split('/').filter(Boolean);
      if (parts.length <= keep) return path || '';
      return `…/${parts.slice(-keep).join('/')}`;
    } catch { return path; }
  };

  const displayLabel = (() => {
    // For commands like "npm run build" just truncate
    if (!filePath) return '';
    if (/\s/.test(filePath) && !/\//.test(filePath)) {
      return filePath.length > 48 ? filePath.slice(0, 45) + '…' : filePath;
    }
    return shortenTail(filePath, 2);
  })();

  // Minimal monochrome icon per action
  const Icon = () => {
    const cls = error ? 'text-red-400' : 'text-muted-foreground';
    const common = `h-4 w-4 ${cls}`;
    switch ((action || '').toLowerCase()) {
      case 'bash':
        // terminal/bolt
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 5h16v14H4z"/>
            <path d="M7 9l3 3-3 3"/>
            <path d="M13 15h4"/>
          </svg>
        );
      case 'search':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.3-4.3"/>
          </svg>
        );
      case 'edit':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
        );
      case 'write':
      case 'todowrite':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v16H4z"/>
            <path d="M8 8h8M8 12h6M8 16h4"/>
          </svg>
        );
      case 'websearch':
      case 'webfetch':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"/>
            <path d="M3 12h18M12 3a15.3 15.3 0 010 18M12 3a15.3 15.3 0 000 18"/>
          </svg>
        );
      case 'read':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={common} fill="currentColor">
            <path d="M4 4h12l4 4v12H4V4Zm12 1.5V9h3.5L16 5.5Z"/>
          </svg>
        );
    }
  };

  const lineCount = useMemo(() => {
    const src = typeof content === 'string' ? content : '';
    if (!src) return 0;
    return src.split('\n').length;
  }, [content]);

  return (
    <div className="mb-1">
      <div className={`flex items-center gap-2 text-sm bg-transparent border-l-2 ${error ? 'border-red-500/60' : 'border-border'} pl-3 pr-2 py-1.5 rounded-r cursor-pointer hover:bg-accent/10`} onClick={() => content && setIsExpanded(!isExpanded)}>
        {content && String(content).length > 0 && (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/60 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Icon />
          <span className={`font-semibold italic ${error ? 'text-red-400' : 'text-foreground/90'}`}>{action}</span>
          {filePath && (
            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/50 text-xs text-foreground/80 font-mono truncate max-w-[320px]" title={filePath}>
              {displayLabel}
            </span>
          )}
          {showMeta && (details || lineCount > 0) && (
            <span className="text-xs text-muted-foreground">{details ? `• ${details}` : ''}</span>
          )}
          {error && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">failed</span>
          )}
        </div>
      </div>
      {isExpanded && typeof content === 'string' && (
        <div className={`mt-1 ml-6 border ${error ? 'border-red-500/40' : 'border-border'} rounded-xl bg-card p-3`}>
          <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap break-words">{content.replace(/```/g, '```')}</pre>
        </div>
      )}
    </div>
  );
}
