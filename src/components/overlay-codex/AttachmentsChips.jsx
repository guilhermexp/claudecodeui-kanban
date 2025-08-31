import React from 'react';

export default function AttachmentsChips({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {attachments.map((att, idx) => (
        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/40 bg-background/40 text-xs">
          <span className="opacity-70">{att.tag}</span>
        </span>
      ))}
    </div>
  );
}

