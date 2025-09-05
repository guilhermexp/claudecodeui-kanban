import React, { useState, useMemo } from 'react';
// Minimal tool output block: header row + collapsible raw text

export default function ToolResultItem({ action = 'Executed', filePath = '', content, icon, details, language = 'bash' }) {
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

  // Minimal monochrome doc/code symbol
  const Icon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
      <path d="M4 4h12l4 4v12H4V4Zm12 1.5V9h3.5L16 5.5Z"/>
    </svg>
  );

  const lineCount = useMemo(() => {
    const src = typeof content === 'string' ? content : '';
    if (!src) return 0;
    return src.split('\n').length;
  }, [content]);

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 text-sm bg-transparent border-l-2 border-border pl-3 pr-2 py-1.5 rounded-r cursor-pointer hover:bg-accent/10" onClick={() => content && setIsExpanded(!isExpanded)}>
        {content && String(content).length > 0 && (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/60 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Icon />
          <span className="font-semibold italic text-foreground/90">{action}</span>
          {filePath && (
            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/50 text-xs text-foreground/80 font-mono truncate max-w-[320px]" title={filePath}>
              {displayLabel}
            </span>
          )}
          {(details || lineCount > 0) && (
            <span className="text-xs text-muted-foreground">• {details || `${lineCount} lines`}</span>
          )}
        </div>
      </div>
      {isExpanded && typeof content === 'string' && (
        <div className="mt-1 ml-6 border border-border rounded-xl bg-card p-3">
          <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap break-words">{content.replace(/```/g, '```')}</pre>
        </div>
      )}
    </div>
  );
}
