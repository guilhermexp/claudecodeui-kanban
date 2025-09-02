import React, { useState } from 'react';

export default function ToolResultItem({ action = 'Executed', filePath = '', content }) {
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

  const Icon = () => {
    switch (action) {
      case 'Edited':
      case 'Created':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M14 20h7v-2.59l-5.7-5.7-4.12 4.12L14 20Zm-3.41-3.41 4.12-4.12-2.3-2.3-4.12 4.12 2.3 2.3ZM3 21V3h12l6 6v3h-2V9h-5V4H5v15h6v2H3Z"/>
          </svg>
        );
      case 'Read':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M6 4h7l5 5v11H6V4Zm7 1.5V9h3.5L13 5.5Z"/>
          </svg>
        );
      case 'Deleted':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Zm3 3v8h2v-8H9Zm4 0v8h2v-8h-2ZM9 4h6v2H9V4Z"/>
          </svg>
        );
      case 'Generated':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 10 10h-2A8 8 0 1 1 12 4V2Zm-1 5h2v6h-2V7Zm0 8h2v2h-2v-2Z"/>
          </svg>
        );
      case 'Searched':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm8.32 14.9 3.39 3.4-1.41 1.4-3.4-3.39 1.42-1.41Z"/>
          </svg>
        );
      case 'Executed':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="currentColor">
            <path d="M3 5h18v14H3V5Zm2 2v10h14V7H5Zm3 8-2-2 3-3-3-3 2-2 5 5-5 5Zm6 0v-2h4v2h-4Z"/>
          </svg>
        );
    }
  };

  return (
    <div className="mb-1">
      <div className="flex h-6 items-center gap-1 text-sm cursor-pointer group" onClick={() => content && setIsExpanded(!isExpanded)}>
        {content && (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground/60 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
        <div className="flex items-center flex-shrink-0"><Icon /></div>
        <span className="text-muted-foreground">{action}</span>
        {filePath && (
          <span className="max-w-xs truncate rounded-md bg-muted px-2 py-0 text-xs text-muted-foreground" title={filePath}>
            {filePath}
          </span>
        )}
      </div>
      {isExpanded && content && (
        <div className="mt-1 ml-5 p-2 bg-muted rounded">
          <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap break-words">{content}</pre>
        </div>
      )}
    </div>
  );
}
