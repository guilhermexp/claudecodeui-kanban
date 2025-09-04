import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Copy, Check, Send, ChevronRight, Loader2 } from 'lucide-react';

// AI-powered prompt enhancement templates
const enhanceTemplates = {
  standard: {
    name: 'Standard',
    system: `Transform the input into a clear, actionable prompt. Focus on:
- Clear objective statement
- Specific requirements
- Expected output format
- Key constraints`,
    process: (input) => ({
      objective: input.split('.')[0] || input,
      requirements: [],
      constraints: ['Be precise', 'Stay focused'],
      format: 'structured'
    })
  },
  implementation: {
    name: 'Code',
    system: `Transform into a technical implementation prompt with:
- Clear technical requirements
- Technologies/languages to use
- Architecture patterns
- Success criteria`,
    process: (input) => ({
      task: input,
      tech_stack: [],
      patterns: [],
      criteria: []
    })
  },
  debug: {
    name: 'Debug',
    system: `Structure as a debugging/problem-solving prompt:
- Problem description
- Expected vs actual behavior
- Error messages/logs
- Steps to reproduce`,
    process: (input) => ({
      issue: input,
      expected: '',
      actual: '',
      steps: []
    })
  },
  creative: {
    name: 'Creative',
    system: `Enhance for creative/brainstorming tasks:
- Core concept
- Creative constraints
- Inspiration sources
- Desired tone/style`,
    process: (input) => ({
      concept: input,
      style: '',
      constraints: [],
      inspiration: []
    })
  }
};

export default function PromptEnhancer({ open, onClose, onSendToClaude, onSendToCodex }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoEnhance, setAutoEnhance] = useState(true);
  const inputRef = useRef(null);
  const enhanceTimer = useRef(null);

  // Position and size state for floating panel
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('prompt_enhancer_pos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { x: window.innerWidth / 2 - 250, y: 100 };
  });
  
  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem('prompt_enhancer_size');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { width: 500, height: 400 };
  });

  // Auto-focus on open
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Save position and size
  useEffect(() => {
    localStorage.setItem('prompt_enhancer_pos', JSON.stringify(position));
  }, [position]);
  
  useEffect(() => {
    localStorage.setItem('prompt_enhancer_size', JSON.stringify(size));
  }, [size]);

  // Auto-enhance with debounce
  useEffect(() => {
    if (!autoEnhance || !input.trim()) {
      setOutput('');
      return;
    }
    
    clearTimeout(enhanceTimer.current);
    enhanceTimer.current = setTimeout(() => {
      enhancePrompt();
    }, 500);
    
    return () => clearTimeout(enhanceTimer.current);
  }, [input, mode, autoEnhance]);

  const enhancePrompt = async () => {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    
    try {
      // Try API first
      const response = await fetch('/api/prompt-enhancer/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: text, 
          mode,
          system: enhanceTemplates[mode].system 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.output) {
          setOutput(data.output);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.log('API unavailable, using local enhancement');
    }

    // Fallback to local enhancement
    const template = enhanceTemplates[mode];
    const enhanced = `## Enhanced Prompt

### Objective
${text}

### Requirements
- Clear and specific instructions
- Actionable steps
- Measurable outcomes

### Approach
1. Analyze the request thoroughly
2. Break down into logical steps
3. Execute with precision
4. Validate results

### Expected Output
Structured, actionable response that directly addresses the objective.

### Constraints
- Stay focused on the main goal
- Be concise yet comprehensive
- Provide practical solutions`;

    setOutput(enhanced);
    setLoading(false);
  };

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [output]);

  const handleSend = useCallback((target, immediate = false) => {
    const text = output || input;
    if (!text) return;
    
    if (target === 'claude' && onSendToClaude) {
      onSendToClaude(text, { send: immediate });
    } else if (target === 'codex' && onSendToCodex) {
      onSendToCodex(text, { send: immediate });
    }
    
    if (immediate) {
      onClose();
    }
  }, [input, output, onSendToClaude, onSendToCodex, onClose]);

  // Drag and resize functionality
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const handleDragStart = (e) => {
    isDragging.current = true;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // Keep within viewport
    const maxX = window.innerWidth - size.width;
    const maxY = window.innerHeight - size.height;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [size]);

  const handleDragEnd = () => {
    isDragging.current = false;
  };
  
  // Resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };
  
  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current) return;
    
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    
    setSize({
      width: Math.max(400, Math.min(resizeStart.current.width + dx, window.innerWidth - position.x)),
      height: Math.max(350, Math.min(resizeStart.current.height + dy, window.innerHeight - position.y))
    });
  }, [position]);
  
  const handleResizeEnd = () => {
    isResizing.current = false;
  };

  useEffect(() => {
    if (isDragging.current) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [handleDragMove]);
  
  useEffect(() => {
    if (isResizing.current) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [handleResizeMove]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Floating Panel - No backdrop */}
      <div
        className="absolute pointer-events-auto"
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)'
        }}
      >
        <div className="bg-background/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b border-border/30 cursor-move select-none bg-gradient-to-r from-background to-muted/20 flex-shrink-0"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Smart Prompt</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Selector - Simplified */}
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              {Object.entries(enhanceTemplates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                    mode === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-accent/50 text-muted-foreground'
                  }`}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
            {/* Input */}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or paste your prompt here..."
                className="w-full min-h-[80px] max-h-[200px] p-3 bg-muted/30 rounded-lg border border-border/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend('claude', true);
                  }
                }}
              />
              {loading && (
                <div className="absolute top-2 right-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Auto-enhance toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoEnhance(!autoEnhance)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  autoEnhance ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                    autoEnhance ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-xs text-muted-foreground">Auto-enhance</span>
            </div>

            {/* Output Preview */}
            {output && (
              <div className="relative group">
                <div className="p-3 bg-card/50 rounded-lg border border-border/30 max-h-[200px] overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                    {output.substring(0, 300)}
                    {output.length > 300 && '...'}
                  </pre>
                </div>
                
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/30 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSend('claude', false)}
                disabled={!input && !output}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Claude
              </button>
              
              <button
                onClick={() => handleSend('codex', false)}
                disabled={!input && !output}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent/50 hover:bg-accent/70 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Codex
              </button>
              
              <button
                onClick={() => handleSend('claude', true)}
                disabled={!input && !output}
                className="px-3 py-2 bg-success/20 hover:bg-success/30 text-success-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send immediately (Cmd+Enter)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-4 pb-2 flex-shrink-0">
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Cmd+Enter to send • Drag header to move • Drag corner to resize
            </p>
          </div>
          
          {/* Resize handle */}
          <div
            className="absolute bottom-1.5 right-1.5 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeStart}
            title="Resize"
          >
            <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17h10M10 20h7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}