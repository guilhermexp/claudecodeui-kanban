import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { analyzePastedContent } from '../utils/prompt-analyzer';
import { authenticatedFetch } from '../utils/api';

export default function PromptsCreateModal({ isOpen, onClose, onSave }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleAnalyze = async () => {
    setBusy(true);
    try {
      // Try server-side Gemini thinking mode first
      try {
        const r = await authenticatedFetch('/api/ai/analyze', {
          method: 'POST',
          body: JSON.stringify({ content: input })
        });
        if (r.ok) {
          const data = await r.json();
          setPreview({ prompts: data.prompts || [], snippets: data.snippets || [], env: data.env || [] });
          return;
        }
      } catch {}
      // Fallback to local heuristic
      const res = analyzePastedContent(input);
      setPreview(res);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    onSave?.(preview);
    setInput('');
    setPreview(null);
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[80vh] p-0 bg-card border border-border mx-2 sm:mx-auto overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border bg-card/95 backdrop-blur">
          <DialogTitle className="text-lg font-semibold">New Item from Paste</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <textarea
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            placeholder="Cole aqui qualquer conteúdo (.env, snippet com ```lang, texto de prompt com {variaveis})"
            rows={10}
            className="w-full bg-black/60 px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleAnalyze} disabled={!input || busy} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50">Analyze</button>
            <button onClick={handleSave} disabled={!preview} className="h-8 px-3 rounded bg-background border border-border text-xs disabled:opacity-50">Save</button>
            <button onClick={onClose} className="h-8 px-3 rounded text-muted-foreground hover:bg-accent text-xs">Cancel</button>
            <span className="text-[11px] text-muted-foreground">Sem digitar: cole, analise, salve.</span>
          </div>
          {preview && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded border border-border p-2 bg-muted/10">
                <div className="font-semibold mb-1">Prompts</div>
                {preview.prompts.length ? preview.prompts.map((p,i)=>(
                  <div key={i} className="mb-2">
                    <div className="font-medium">{p.title || 'Prompt'}</div>
                    <div className="text-[11px] text-muted-foreground">Vars: {(p.variables||[]).map(v=>v.name).join(', ') || '—'}</div>
                  </div>
                )) : <div className="text-muted-foreground">—</div>}
              </div>
              <div className="rounded border border-border p-2 bg-muted/10">
                <div className="font-semibold mb-1">Snippets</div>
                {preview.snippets.length ? preview.snippets.map((s,i)=>(
                  <div key={i} className="mb-2">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground">{s.language}</div>
                  </div>
                )) : <div className="text-muted-foreground">—</div>}
              </div>
              <div className="rounded border border-border p-2 bg-muted/10">
                <div className="font-semibold mb-1">Env</div>
                {preview.env.length ? preview.env.map((e,i)=>(
                  <div key={i} className="mb-1 flex justify-between gap-2">
                    <span className="font-medium break-all">{e.key}</span>
                    <span className="text-muted-foreground truncate" title={e.value}>{e.value}</span>
                  </div>
                )) : <div className="text-muted-foreground">—</div>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
