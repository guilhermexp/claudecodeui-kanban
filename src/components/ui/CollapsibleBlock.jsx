import React, { useState, useMemo } from 'react';

// Lightweight, Tailwind-based collapsible block used in chat input.
// Visual cues inspired by Codex CLI shell output blocks.
// Props:
// - label: string shown next to chevron
// - meta: optional small, muted text on the left (e.g., "34 lines")
// - actions: optional React nodes rendered on the right side of the header
// - defaultOpen: boolean (default true)
// - className: extra classes for the wrapper when open
// - children: content shown when expanded
export default function CollapsibleBlock({
  label = 'Block',
  meta,
  actions,
  defaultOpen = true,
  className = '',
  children,
  hideHeader = false,
  customHeader = null,
  collapsible = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const headerMeta = useMemo(() => {
    if (!meta) return null;
    return (
      <span className="text-xs text-muted-foreground/80">
        {meta}
      </span>
    );
  }, [meta]);

  if (hideHeader) {
    // Render container without header; not collapsible.
    return (
      <div className="rounded-2xl bg-muted border border-border">
        <div className={`px-6 py-8 rounded-2xl ${className}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-muted/60 ${open ? 'shadow-sm' : ''}`}>
      <div className="w-full flex items-center justify-between px-4 py-2 rounded-2xl">
        <div className="flex items-center gap-3 min-w-0">
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="shrink-0 hover:bg-accent/50 rounded-md p-1"
              aria-expanded={open}
              title={open ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {customHeader ? (
            <div className="min-w-0 flex items-center gap-3">{customHeader}</div>
          ) : (
            <>
              <span className="text-sm text-foreground/90 truncate">{label}</span>
              {headerMeta}
            </>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {open && children && (
        <div className={`px-6 py-6 border-t border-border/60 rounded-b-2xl ${className}`}>
          {children}
        </div>
      )}
    </div>
  );
}
