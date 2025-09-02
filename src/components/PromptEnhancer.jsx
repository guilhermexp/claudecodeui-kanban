import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Wand2, X, Copy, Check, FileText, RotateCcw, Trash2, Send, ChevronDown } from 'lucide-react';

// Local, placeholder "enhancer" to simulate behavior until backend is wired.
// Keeps UX functional and easy to swap for an API call later.
const enhancePromptLocally = (input, format, systemPrompt) => {
  const text = (input || '').trim();
  if (!text) return '';

  const baseBullets = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l.replace(/^[-•\s]+/, '')}`)
    .join('\n');

  const now = new Date().toISOString();
  switch (format) {
    case 'json':
      return JSON.stringify(
        {
          meta: {
            improved: true,
            generated_at: now,
            notes: 'Placeholder enhancement. Backend will refine.',
            system: systemPrompt || ''
          },
          instructions: text,
          structure: {
            goals: [text.slice(0, 120)],
            constraints: [
              'Be precise and concise',
              'Use clear structure and formatting',
            ],
            deliverables: ['Clear, directly usable output'],
            steps: baseBullets.split('\n').map((s) => s.replace(/^\-\s/, '')),
          },
        },
        null,
        2
      );
    case 'xml':
      return [
        '<prompt enhanced="true">',
        `  <generatedAt>${now}</generatedAt>`,
        '  <system>',
        `    ${escapeXml(systemPrompt || '')}`,
        '  </system>',
        '  <instructions>',
        `    ${escapeXml(text)}`,
        '  </instructions>',
        '  <structure>',
        '    <goals>',
        `      <item>${escapeXml(text.slice(0, 120))}</item>`,
        '    </goals>',
        '    <constraints>',
        '      <item>Be precise and concise</item>',
        '      <item>Use clear structure and formatting</item>',
        '    </constraints>',
        '    <steps>',
        ...baseBullets.split('\n').map((s) => `      <step>${escapeXml(s.replace(/^\-\s/, ''))}</step>`),
        '    </steps>',
        '  </structure>',
        '</prompt>',
      ].join('\n');
    case 'yaml':
      return [
        'meta:',
        '  enhanced: true',
        `  generated_at: ${now}`,
        '  system: |',
        ...(systemPrompt ? systemPrompt.split('\n').map((l) => `    ${l}`) : ['    ']),
        'instructions: |',
        ...text.split('\n').map((l) => `  ${l}`),
        'structure:',
        '  goals:',
        `    - ${text.slice(0, 120)}`,
        '  constraints:',
        '    - Be precise and concise',
        '    - Use clear structure and formatting',
        '  steps:',
        ...baseBullets.split('\n').map((s) => `    - ${s.replace(/^\-\s/, '')}`),
      ].join('\n');
    default:
      // text
      return [
        'Improved Prompt (draft)\n',
        ...(systemPrompt
          ? ['Guidance:', `  ${systemPrompt.split('\n').join('\n  ')}`, '']
          : []),
        'Objective:',
        `  ${text.slice(0, 120)}`,
        '',
        'Key Constraints:',
        '  - Be precise and concise',
        '  - Use clear structure and formatting',
        '',
        'Steps:',
        baseBullets,
      ].join('\n');
  }
};

const escapeXml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export default function PromptEnhancer({ open, onClose, onSendToClaude, onSendToCodex }) {
  const [format, setFormat] = useState('text'); // 'text' | 'json' | 'xml' | 'yaml'
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Floating position + size
  const LS_POS = 'prompt_enhancer_pos_v1';
  const LS_SIZE = 'prompt_enhancer_size_v1';
  const LS_SYS = 'prompt_enhancer_system_v1';
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_POS) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    } catch {}
    return { x: 0, y: 0 };
  });
  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_SIZE) || 'null');
      if (saved && Number.isFinite(saved.w) && Number.isFinite(saved.h)) return saved;
    } catch {}
    return { w: 560, h: 520 };
  });
  const defaultSystem = 'Você é um Aprimorador de Prompt. Reescreva a entrada de forma clara, estruturada e objetiva, mantendo intenção e contexto. Organize por objetivo, restrições, passos e critérios de aceite. Adapte formato (Text/JSON/XML/YAML) conforme seleção.';
  const [showSystem, setShowSystem] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(() => {
    try {
      return localStorage.getItem(LS_SYS) || defaultSystem;
    } catch {
      return defaultSystem;
    }
  });
  // Preset modes
  const LS_MODE = 'prompt_enhancer_mode_v1';
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(LS_MODE) || 'standard'; } catch { return 'standard'; }
  });
  useEffect(() => { try { localStorage.setItem(LS_MODE, mode); } catch {} }, [mode]);
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!open) return;
    // First open: center if no saved pos
    setTimeout(() => {
      if (pos.x === 0 && pos.y === 0) {
        const w = size.w;
        const h = size.h;
        const x = Math.max(12, Math.round(window.innerWidth / 2 - w / 2));
        const y = Math.max(12, Math.round(window.innerHeight / 6));
        setPos({ x, y });
      }
      inputRef.current?.focus();
    }, 20);
  }, [open]);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(LS_POS, JSON.stringify(pos)); } catch {}
  }, [pos.x, pos.y]);
  useEffect(() => {
    try { localStorage.setItem(LS_SIZE, JSON.stringify(size)); } catch {}
  }, [size.w, size.h]);

  useEffect(() => {
    try { localStorage.setItem(LS_SYS, systemPrompt); } catch {}
  }, [systemPrompt]);

  const [loading, setLoading] = useState(false);
  const handleClearOutput = () => setOutput('');
  const handleRegenerate = async () => {
    await handleEnhance();
  };
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const sendBtnRef = useRef(null);
  const hoverTimer = useRef(null);
  useEffect(() => {
    if (!sendMenuOpen) return;
    const onDoc = (e) => {
      if (!sendBtnRef.current) return setSendMenuOpen(false);
      if (!sendBtnRef.current.closest) return setSendMenuOpen(false);
      const menu = document.getElementById('pe-send-menu');
      if (!menu) return setSendMenuOpen(false);
      if (sendBtnRef.current.contains(e.target) || menu.contains(e.target)) return;
      setSendMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [sendMenuOpen]);
  const handleEnhance = async () => {
    if (!input || !input.trim()) return;
    setLoading(true);
    try {
      const r = await fetch('/api/prompt-enhancer/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, format, system: systemPrompt, mode }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.output) {
          setOutput(data.output);
          setLoading(false);
          return;
        }
      }
    } catch {}
    // Fallback local
    const out = enhancePromptLocally(input, format, systemPrompt);
    setOutput(out);
    setLoading(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  // Drag handlers
  const clampPos = (x, y, w = size.w, h = size.h) => {
    const maxX = Math.max(0, window.innerWidth - w - 6);
    const maxY = Math.max(0, window.innerHeight - h - 6);
    return { x: Math.min(Math.max(6, x), maxX), y: Math.min(Math.max(6, y), maxY) };
  };

  const onDragStart = (e) => {
    e.preventDefault();
    isDragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - pos.x, y: clientY - pos.y };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
  };
  const onDragMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const nx = clientX - dragOffset.current.x;
    const ny = clientY - dragOffset.current.y;
    setPos((p) => clampPos(nx, ny));
  };
  const onDragEnd = () => {
    isDragging.current = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
  };

  // Resize handlers (bottom-right handle)
  const MIN_W = 380;
  const MIN_H = 260;
  const onResizeStart = (e) => {
    e.preventDefault();
    isResizing.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeStart.current = { x: clientX, y: clientY, w: size.w, h: size.h };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
    window.addEventListener('touchmove', onResizeMove, { passive: false });
    window.addEventListener('touchend', onResizeEnd);
  };
  const onResizeMove = (e) => {
    if (!isResizing.current) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - resizeStart.current.x;
    const dy = clientY - resizeStart.current.y;
    const newW = Math.min(Math.max(MIN_W, resizeStart.current.w + dx), window.innerWidth - pos.x - 6);
    const newH = Math.min(Math.max(MIN_H, resizeStart.current.h + dy), window.innerHeight - pos.y - 6);
    setSize({ w: newW, h: newH });
  };
  const onResizeEnd = () => {
    isResizing.current = false;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
    window.removeEventListener('touchmove', onResizeMove);
    window.removeEventListener('touchend', onResizeEnd);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Floating panel (draggable/resizable) */}
      <div
        className="absolute pointer-events-auto rounded-[18px] border bg-card/95 dark:bg-[#141414]/95 border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        {/* Compact header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b cursor-move select-none border-black/10 dark:border-white/10 bg-gradient-to-b from-[#f6f6f6] to-white dark:from-[#171717] dark:to-[#141414]"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black/10 text-black/70 dark:bg-white/10 dark:text-white/80 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-[13px] font-medium text-foreground">Prompt Enhancer</div>
            <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground capitalize">
              {format}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSystem((s) => !s)}
              className={`px-2 h-7 rounded-md text-[11px] border transition ${
                showSystem
                  ? 'bg-background/80 border-border/40 text-foreground'
                  : 'bg-background/40 border-border/30 text-muted-foreground hover:text-foreground'
              }`}
              title="System Prompt"
            >
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sys</span>
              </span>
            </button>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 flex flex-col gap-3 grow min-h-0">
          {/* Segmented control */}
          <div className="inline-flex items-center rounded-[14px] bg-muted p-1 border border-border shadow-inner dark:bg-[#1a1a1a] dark:border-white/10">
            {[
              { key: 'text', label: 'Text' },
              { key: 'json', label: 'JSON' },
              { key: 'xml', label: 'XML' },
              { key: 'yaml', label: 'YAML' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFormat(t.key)}
                className={`px-4 py-2 text-[12px] rounded-[10px] transition-colors border ${
                  format === t.key
                    ? 'bg-background text-foreground border-border shadow dark:bg-[#232323] dark:text-white/90 dark:border-white/10'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Preset modes */}
          <div className="inline-flex items-center rounded-[14px] bg-muted p-1 border border-border shadow-inner ml-2 dark:bg-[#1a1a1a] dark:border-white/10">
            {[
              { key: 'standard', label: 'Standard' },
              { key: 'implementacao', label: 'Implementação' },
              { key: 'bugs', label: 'Bugs' },
              { key: 'refatoracao', label: 'Refatoração' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-2 text-[12px] rounded-[10px] transition-colors border ${
                  mode === m.key
                    ? 'bg-background text-foreground border-border shadow dark:bg-[#232323] dark:text-white/90 dark:border-white/10'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                }`}
                title={`Preset: ${m.label}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* System Prompt (collapsible) */}
          {showSystem && (
            <div className="rounded-[14px] border border-border bg-muted/80 p-3 dark:border-white/10 dark:bg-[#161616]/80">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-medium text-foreground">System Prompt</div>
                <button
                  onClick={() => setSystemPrompt(defaultSystem)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  title="Reset to default"
                >Reset</button>
              </div>
              <textarea
                rows={4}
                className="w-full bg-muted px-3 py-2 rounded-[10px] border border-border text-sm resize-y text-foreground placeholder:text-muted-foreground"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instruções do sistema utilizadas pela IA"
              />
              <div className="text-[11px] text-muted-foreground mt-1">Auto-salvo</div>
            </div>
          )}

          {/* Top: Output viewer (full width) */}
          <div className="relative rounded-[20px] p-4 border border-border dark:border-white/10 shadow-[inset_0_1px_0_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)] flex-1 min-h-[140px] overflow-hidden bg-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-semibold text-foreground">
                After (<span className="capitalize">{format}</span>)
                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground">{mode}</span>
              </div>
              <div
                className="flex items-center gap-1.5 relative"
                onMouseEnter={() => {
                  // Open on hover for quicker access (ignore when disabled)
                  if (!output && !input) return;
                  clearTimeout(hoverTimer.current);
                  setSendMenuOpen(true);
                }}
                onMouseLeave={() => {
                  // Small delay to allow moving into the menu without flicker
                  clearTimeout(hoverTimer.current);
                  hoverTimer.current = setTimeout(() => setSendMenuOpen(false), 120);
                }}
              >
                {/* Compact split button with menu */}
                <button
                  ref={sendBtnRef}
                  onClick={() => setSendMenuOpen((s) => !s)}
                  disabled={!output && !input}
                  className={`h-7 px-2 rounded-md border text-[11px] flex items-center gap-1 transition ${
                    !output && !input
                      ? 'bg-muted/60 border-border text-muted-foreground cursor-not-allowed'
                      : 'bg-background/80 border-border hover:bg-accent text-foreground'
                  }`}
                  title="Enviar para..."
                >
                  <Send className="w-3.5 h-3.5" />
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {sendMenuOpen && (
                  <div id="pe-send-menu" className="absolute right-0 top-8 z-10 min-w-[180px] rounded-md border border-border bg-popover shadow-xl p-1 dark:border-white/10 dark:bg-[#191919]" onMouseEnter={() => { clearTimeout(hoverTimer.current); setSendMenuOpen(true); }} onMouseLeave={() => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setSendMenuOpen(false), 120); }}>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Claude</div>
                    <button
                      onClick={() => { const txt = output || input; onSendToClaude && onSendToClaude(txt, { send: false }); setSendMenuOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-[12px] text-foreground"
                    >Inserir no input</button>
                    <button
                      onClick={() => { const txt = output || input; onSendToClaude && onSendToClaude(txt, { send: true }); setSendMenuOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-[12px] text-foreground"
                    >Enviar agora</button>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pt-2 pb-1">Codex</div>
                    <button
                      onClick={() => { const txt = output || input; onSendToCodex && onSendToCodex(txt, { send: false }); setSendMenuOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-[12px] text-foreground"
                    >Inserir no input</button>
                    <button
                      onClick={() => { const txt = output || input; onSendToCodex && onSendToCodex(txt, { send: true }); setSendMenuOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-[12px] text-foreground"
                    >Enviar agora</button>
                  </div>
                )}
              <button
                  onClick={handleRegenerate}
                  disabled={loading || !input.trim()}
                  className={`h-7 px-2 rounded-md border text-[11px] flex items-center gap-1 transition ${
                    loading || !input.trim()
                      ? 'bg-muted/60 border-border text-muted-foreground cursor-not-allowed'
                      : 'bg-background/80 border-border hover:bg-accent text-foreground'
                  }`}
                  title="Gerar novamente"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gerar</span>
                </button>
                <button
                  onClick={handleClearOutput}
                  disabled={!output}
                  className={`h-7 px-2 rounded-md border text-[11px] flex items-center gap-1 transition ${
                    !output
                      ? 'bg-muted/60 border-border text-muted-foreground cursor-not-allowed'
                      : 'bg-background/80 border-border hover:bg-accent text-foreground'
                  }`}
                  title="Limpar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </div>
            </div>
            <pre className="h-[calc(100%-22px)] overflow-auto text-[13px] leading-relaxed whitespace-pre-wrap font-mono text-foreground/90 pr-8">
{output || 'Your improved prompt will appear here after you enhance.'}
            </pre>
            {/* Floating copy button at right-middle */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <button
                onClick={handleCopy}
                disabled={!output}
                className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition shadow ${
                  output
                    ? 'bg-background/80 border-border/40 hover:bg-accent text-foreground'
                    : 'bg-muted/60 border-transparent text-muted-foreground cursor-not-allowed'
                }`}
                title="Copy"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Bottom: Input + Enhance (full width) */}
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <textarea
                ref={inputRef}
                rows={2}
                className="w-full bg-muted px-3 pr-12 py-2.5 rounded-[16px] border border-border text-sm font-normal resize-y min-h-[72px] text-foreground placeholder:text-muted-foreground"
                placeholder="Digite seu prompt aqui para aprimorar"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleEnhance();
                  }
                }}
              />
              <button
                onClick={handleEnhance}
                disabled={loading || !input.trim()}
                className={`absolute bottom-2 right-2 h-8 w-8 rounded-lg border flex items-center justify-center text-[12px] transition shadow ${
                  loading || !input.trim()
                    ? 'bg-muted/60 border-border text-muted-foreground cursor-not-allowed'
                    : 'bg-background/80 border-border hover:bg-accent text-foreground'
                }`}
                title="Enhance (Ctrl/Cmd + Enter)"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground">Ctrl/Cmd + Enter</div>
          </div>
        </div>

        {/* Resize handle (bottom-right) */}
        <div
          className="absolute right-1.5 bottom-1.5 w-4 h-4 rounded-sm cursor-se-resize opacity-70 hover:opacity-100"
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          title="Resize"
        >
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17h10M10 20h7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
