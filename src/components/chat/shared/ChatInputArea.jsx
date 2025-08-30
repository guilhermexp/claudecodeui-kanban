import React, { useRef } from 'react';

export const ChatInputArea = ({ 
  input, 
  setInput, 
  onSend, 
  disabled = false, 
  attachments = [], 
  imageAttachments = [],
  onImageSelect,
  onImageRemove 
}) => {
  const fileInputRef = useRef(null);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  
  const handleImageSelect = (files) => {
    if (!onImageSelect) return;
    
    const validImages = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    ).slice(0, 5);
    
    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageSelect({
          id: `img-${Date.now()}-${Math.random()}`,
          dataUrl: e.target.result,
          name: file.name,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    });
  };
  
  return (
    <div className="space-y-2">
      {/* Image preview area */}
      {imageAttachments.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex gap-2 flex-wrap">
            {imageAttachments.map(img => (
              <div key={img.id} className="relative group">
                <img 
                  src={img.dataUrl} 
                  alt={img.name}
                  className="w-16 h-16 object-cover rounded-md border border-border"
                />
                {onImageRemove && (
                  <button
                    onClick={() => onImageRemove(img.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-b-md truncate">
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Input container */}
      <div className="space-y-4 rounded-2xl bg-muted border border-border py-8 px-6">
        <div className="flex items-center gap-3">
          {/* Attach button */}
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/*" 
            multiple 
            className="hidden" 
            onChange={(e) => handleImageSelect(e.target.files)} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-all" 
            title="Attach"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          
          {/* Textarea */}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            className="flex-1 text-[15px] leading-relaxed bg-transparent outline-none text-foreground placeholder:text-[#999999] resize-none py-1"
            disabled={disabled}
            rows={1}
            style={{ 
              minHeight: '60px', 
              maxHeight: '150px', 
              height: 'auto', 
              overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' 
            }}
          />
          
          {/* Send button */}
          <button
            onClick={onSend}
            title="Send"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40"
            disabled={disabled || (!input.trim() && attachments.length === 0 && imageAttachments.length === 0)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
        
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {attachments.map((att, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/40 bg-background/40 text-xs">
                <span className="opacity-70">{att.tag}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};