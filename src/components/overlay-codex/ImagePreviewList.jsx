import React from 'react';

export default function ImagePreviewList({ images, onRemove }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="px-3 py-2 mb-2">
      <div className="flex gap-2 flex-wrap">
        {images.map(img => (
          <div key={img.id} className="relative group">
            <img src={img.dataUrl} alt={img.name} className="w-16 h-16 object-cover rounded-md border border-border" />
            <button
              onClick={() => onRemove(img.id)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-b-md truncate">
              {img.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

