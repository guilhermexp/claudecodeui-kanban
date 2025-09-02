import React, { useMemo, useState, useEffect } from 'react';
import { loadPromptsHubState, savePromptsHubState, upsertItem, deleteItem, detectTemplateVariables } from '../utils/prompts-hub';
import PromptsCreateModal from './PromptsCreateModal';

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}

function ListItem({ active, title, description, onClick, onDelete }) {
  return (
    <div
      className={`p-2 rounded-md cursor-pointer border ${active ? 'bg-muted border-border' : 'border-transparent hover:bg-accent'}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium truncate">{title}</div>
          {description && <div className="text-[11px] text-muted-foreground truncate">{description}</div>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="text-muted-foreground hover:text-destructive p-1"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function PromptsHub({ onClose }) {
  const [state, setState] = useState(loadPromptsHubState());
  const [tab, setTab] = useState('prompts'); // 'prompts' | 'snippets' | 'env' | 'indexes'
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [varValues, setVarValues] = useState({});

  useEffect(() => { savePromptsHubState(state); }, [state]);

  const list = tab === 'prompts' ? state.prompts : tab === 'snippets' ? state.snippets : tab === 'env' ? state.env : [];

  // Build tag cloud for Prompts
  const allTags = useMemo(() => {
    if (tab !== 'prompts') return [];
    const s = new Set();
    state.prompts.forEach(p => (p.tags||[]).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [state.prompts, tab]);
  const [activeTag, setActiveTag] = useState(null);

  const filtered = useMemo(() => {
    let arr = list;
    if (tab === 'prompts' && activeTag) {
      arr = arr.filter((p) => (p.tags||[]).includes(activeTag));
    }
    if (!query) return arr;
    const q = query.toLowerCase();
    if (tab === 'env') return arr.filter((i) => `${i.key}=${i.value}`.toLowerCase().includes(q));
    return arr.filter((i) => `${i.title} ${i.description || ''}`.toLowerCase().includes(q));
  }, [list, query, tab, activeTag]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    if (tab === 'env') return list.find((x) => x.key === selectedId) || null;
    return list.find((x) => x.id === selectedId) || null;
  }, [selectedId, list, tab]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(tab === 'env' ? filtered[0].key : filtered[0].id);
    }
  }, [filtered, selectedId, tab]);

  const [showCreate, setShowCreate] = useState(false);
  const handleNew = () => setShowCreate(true);

  const handleDelete = (id) => {
    if (tab === 'prompts') setState((s) => ({ ...s, prompts: deleteItem(s.prompts, id) }));
    else if (tab === 'snippets') setState((s) => ({ ...s, snippets: deleteItem(s.snippets, id) }));
    else setState((s) => ({ ...s, env: s.env.filter((x) => x.key !== id) }));
    setSelectedId(null);
  };

  const handleCopy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  // Renderers
  const renderEditor = () => {
    if (!selected) return <div className="text-sm text-muted-foreground p-3">Select an item to edit</div>;
    if (tab === 'prompts') return <PromptEditor prompt={selected} onChange={updatePrompt} onCopy={handleCopy} varValues={varValues} setVarValues={setVarValues} />;
    if (tab === 'snippets') return <SnippetEditor snippet={selected} onChange={updateSnippet} onCopy={handleCopy} />;
    return <EnvEditor item={selected} onChange={updateEnv} />;
  };

  function updatePrompt(next) {
    setState((s) => ({ ...s, prompts: upsertItem(s.prompts, next) }));
  }
  function updateSnippet(next) {
    setState((s) => ({ ...s, snippets: upsertItem(s.snippets, next) }));
  }
  function updateEnv(next) {
    setState((s) => ({ ...s, env: s.env.map((e) => (e.key === next.key ? next : e)) }));
    setSelectedId(next.key);
  }

  return (
    <div className="h-full flex flex-col bg-card text-foreground">
      {/* Top tabs + search */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <ToolbarButton onClick={() => setTab('prompts')} active={tab==='prompts'} title="Prompts">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"/></svg>
            <span>Prompts</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => setTab('snippets')} active={tab==='snippets'} title="Snippets">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
            <span>Snippets</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => setTab('env')} active={tab==='env'} title="Env">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8V4m0 0L8 8m4-4l4 4M6 12h12M6 16h12M6 20h12"/></svg>
            <span>Env</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => setTab('indexes')} active={tab==='indexes'} title="Indexes">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span>Indexes</span>
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search" className="h-8 bg-background text-xs px-3 rounded-md border border-border focus:outline-none w-56" />
          <button onClick={handleNew} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs">New</button>
          <button onClick={onClose} className="h-8 px-3 rounded-md text-muted-foreground hover:bg-accent text-xs">Close</button>
        </div>
      </div>

      {/* Body: two-column layout inside modal */}
      {tab === 'prompts' ? (
        <div className="flex-1 min-h-0 grid grid-cols-12">
          {/* Left: Library */}
          <div className="col-span-5 border-r border-border h-full flex flex-col">
            {/* Tag chips */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 overflow-x-auto">
              <button className={`text-[11px] px-2 py-1 rounded-full border ${!activeTag?'bg-background text-foreground border-border':'text-muted-foreground hover:text-foreground'}`} onClick={()=>setActiveTag(null)}>All</button>
              {allTags.map(t => (
                <button key={t} className={`text-[11px] px-2 py-1 rounded-full border ${activeTag===t?'bg-background text-foreground border-border':'text-muted-foreground hover:text-foreground'}`} onClick={()=>setActiveTag(t)}>{t}</button>
              ))}
            </div>
            
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {filtered.map((p) => (
                <div key={p.id}
                  className={`rounded-xl border ${selectedId===p.id?'border-primary/60 bg-muted/30':'border-border bg-muted/10 hover:bg-muted/20'} p-3 transition-colors cursor-pointer`}
                  onClick={()=>setSelectedId(p.id)}
                >
                  <div className="text-base font-semibold mb-1">{p.title}</div>
                  {p.description && <div className="text-xs text-muted-foreground mb-2">{p.description}</div>}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {(p.tags||[]).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{t}</span>)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent" onClick={(e)=>{e.stopPropagation(); setSelectedId(p.id);}}>Use agent</button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length===0 && (
                <div className="text-xs text-muted-foreground">No prompts found.</div>
              )}
            </div>
          </div>

          {/* Right: Agent details */}
          <div className="col-span-7 h-full overflow-auto p-3 space-y-3">
            {selected ? (
              <>
                {/* Agent header */}
                <div className="rounded-xl border border-border bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">{selected.title}</div>
                      {selected.description && <div className="text-xs text-muted-foreground mt-1 max-w-prose">{selected.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground" onClick={()=>handleCopy(buildPreview(selected, varValues))}>Copy Preview</button>
                      <button className="text-xs px-2 py-1 rounded bg-background border border-border" onClick={()=>handleCopy(selected.template || '')}>Copy Template</button>
                    </div>
                  </div>
                </div>

                {/* Variables */}
                <div className="rounded-xl border border-border bg-muted/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Variables</div>
                    <button className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent" onClick={()=>insertMissingVarsFromTemplate(selected, updatePrompt)}>Sync with template</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(selected.variables||[]).map((v, idx)=> (
                      <div key={v.name} className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">{v.name}</div>
                        <input className="w-full bg-background px-2 py-1 rounded border border-border text-sm" value={varValues[v.name] || ''} placeholder={v.example || 'value'} onChange={(e)=>setVarValues({...varValues, [v.name]: e.target.value})} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prompt editor */}
                <div className="rounded-xl border border-border bg-muted/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Prompt</div>
                    <div className="flex items-center gap-2">
                      <button className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent" onClick={()=>updatePrompt({...selected, template: (selected.template||'') + '{' + ((selected.variables?.[0]?.name)||'var') + '}'})}>Insert var</button>
                    </div>
                  </div>
                  <textarea
                    value={selected.template || ''}
                    onChange={(e)=>updatePrompt({ ...selected, template: e.target.value })}
                    rows={10}
                    className="w-full bg-black/60 px-3 py-2 rounded-lg border border-border text-sm font-mono"
                  />
                </div>

                {/* Preview */}
                <div className="rounded-xl border border-border bg-muted/10 p-3">
                  <div className="text-sm font-semibold mb-2">Preview</div>
                  <pre className="text-xs whitespace-pre-wrap p-3 bg-black/60 rounded-lg border border-border">{buildPreview(selected, varValues)}</pre>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground p-3">Select a prompt from the list</div>
            )}
          </div>
        </div>
      ) : tab === 'indexes' ? (
        <IndexesView onClose={onClose} />
      ) : (
        // Snippets and Env — padronizados em cards
        <div className="flex-1 min-h-0 grid grid-cols-12">
          {/* Lista em cards à esquerda */}
          <div className="col-span-5 border-r border-border h-full overflow-auto p-3 space-y-3">
            {filtered.map((item) => {
              const idKey = tab === 'env' ? item.key : item.id;
              const title = tab === 'env' ? item.key : item.title;
              const desc = tab === 'env' ? (item.masked ? '••••••' : item.value) : item.description;
              return (
                <div key={idKey}
                  className={`rounded-xl border ${selectedId===idKey?'border-primary/60 bg-muted/30':'border-border bg-muted/10 hover:bg-muted/20'} p-3 transition-colors cursor-pointer`}
                  onClick={()=>setSelectedId(idKey)}
                >
                  <div className="text-base font-semibold mb-1 truncate">{title || (tab==='snippets'?'Untitled snippet':'(empty)')}</div>
                  {desc && <div className="text-xs text-muted-foreground mb-2 truncate">{desc}</div>}
                  <div className="flex items-center justify-end">
                    <button className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent" onClick={(e)=>{e.stopPropagation(); setSelectedId(idKey);}}>Open</button>
                  </div>
                </div>
              );
            })}
            {filtered.length===0 && (
              <div className="text-xs text-muted-foreground">No items</div>
            )}
          </div>

          {/* Editor em cards à direita */}
          <div className="col-span-7 h-full overflow-auto p-3 space-y-3">
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              {renderEditor()}
            </div>
          </div>
        </div>
      )}
      {/* Creation modal: paste → analyze → save */}
      <PromptsCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(parsed) => {
          setState((s) => ({
            ...s,
            prompts: [...s.prompts, ...parsed.prompts.map(p => ({ ...p, id: p.id || `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }))],
            snippets: [...s.snippets, ...parsed.snippets.map(sn => ({ ...sn, id: sn.id || `s-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }))],
            env: mergeEnv(s.env, parsed.env),
          }));
          // Auto-select first created prompt/snippet
          if (parsed.prompts?.[0]) setTab('prompts'), setSelectedId(parsed.prompts[0].id);
          else if (parsed.snippets?.[0]) setTab('snippets'), setSelectedId(parsed.snippets[0].id);
        }}
      />
    </div>
  );
}

function PromptEditor({ prompt, onChange, onCopy, varValues, setVarValues }) {
  const varsInTemplate = useMemo(() => detectTemplateVariables(prompt.template), [prompt.template]);
  useEffect(() => {
    // Ensure var fields exist
    const missing = varsInTemplate.filter((v) => !prompt.variables?.some((vv) => vv.name === v));
    if (missing.length > 0) {
      const updated = { ...prompt, variables: [...(prompt.variables||[]), ...missing.map((n)=>({ name:n, example:'' }))] };
      onChange(updated);
    }
  }, [varsInTemplate]);

  const preview = useMemo(() => {
    let t = prompt.template || '';
    const allVars = Object.fromEntries((prompt.variables||[]).map(v=>[v.name, v.example]));
    const merged = { ...allVars, ...(varValues||{}) };
    t = t.replace(/\{([a-zA-Z0-9_\.]+)\}/g, (_, k) => merged[k] ?? `{${k}}`);
    return t;
  }, [prompt, varValues]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Title</label>
          <input value={prompt.title} onChange={(e)=>onChange({ ...prompt, title:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Tags (comma separated)</label>
          <input
            value={(prompt.tags||[]).join(', ')}
            onChange={(e)=>onChange({ ...prompt, tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })}
            className="w-full bg-muted px-2 py-1 rounded border border-border text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Description</label>
        <input value={prompt.description} onChange={(e)=>onChange({ ...prompt, description:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground">Template</label>
        <textarea value={prompt.template} onChange={(e)=>onChange({ ...prompt, template:e.target.value })} rows={6} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm font-mono" />
      </div>

      {/* Variables */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-1">Variables</div>
        <div className="grid grid-cols-2 gap-2">
          {(prompt.variables||[]).map((v, idx)=>(
            <div key={v.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{v.name}</span>
                <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={()=>{
                  const next = { ...prompt, variables: (prompt.variables||[]).filter((x,i)=>i!==idx) };
                  onChange(next);
                }}>Remove</button>
              </div>
              <input
                placeholder="example"
                value={v.example || ''}
                onChange={(e)=>{
                  const nextVars = (prompt.variables||[]).slice();
                  nextVars[idx] = { ...v, example:e.target.value };
                  onChange({ ...prompt, variables: nextVars });
                }}
                className="w-full bg-muted px-2 py-1 rounded border border-border text-sm"
              />
              <input
                placeholder="value for preview"
                value={varValues[v.name] || ''}
                onChange={(e)=>setVarValues({ ...varValues, [v.name]: e.target.value })}
                className="w-full bg-background px-2 py-1 rounded border border-border text-sm"
              />
            </div>
          ))}
        </div>
        <button
          className="mt-2 text-xs px-2 py-1 rounded bg-muted hover:bg-accent"
          onClick={()=>{
            const name = prompt.variables?.length ? `var_${prompt.variables.length+1}` : 'var_1';
            onChange({ ...prompt, variables: [...(prompt.variables||[]), { name, example:'' }] });
          }}
        >Add Variable</button>
      </div>

      {/* Preview & Copy */}
      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground">Preview</div>
        <pre className="p-2 bg-black/60 rounded border border-border text-xs whitespace-pre-wrap">{preview}</pre>
        <div className="flex gap-2">
          <button className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground" onClick={()=>onCopy(preview)}>Copy Preview</button>
          <button className="text-xs px-2 py-1 rounded bg-muted" onClick={()=>onCopy(prompt.template)}>Copy Template</button>
        </div>
      </div>
    </div>
  );
}

function SnippetEditor({ snippet, onChange, onCopy }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Title</label>
          <input value={snippet.title} onChange={(e)=>onChange({ ...snippet, title:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
        </div>
        <div>
          <label className="text=[11px] text-muted-foreground">Language</label>
          <input value={snippet.language||'text'} onChange={(e)=>onChange({ ...snippet, language:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Description</label>
        <input value={snippet.description} onChange={(e)=>onChange({ ...snippet, description:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Code</label>
        <textarea value={snippet.code} onChange={(e)=>onChange({ ...snippet, code:e.target.value })} rows={10} className="w-full bg-black/60 px-2 py-1 rounded border border-border text-xs font-mono" />
      </div>
      <div className="flex gap-2">
        <button className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground" onClick={()=>onCopy(snippet.code)}>Copy Code</button>
      </div>
    </div>
  );
}

function EnvEditor({ item, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Key</label>
          <input value={item.key} onChange={(e)=>onChange({ ...item, key:e.target.value })} className="w-full bg-muted px-2 py-1 rounded border border-border text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Masked</label>
          <div className="flex items-center gap-2 h-8">
            <input type="checkbox" checked={!!item.masked} onChange={(e)=>onChange({ ...item, masked:e.target.checked })} />
            <span className="text-xs text-muted-foreground">Hide value</span>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Value</label>
        <input value={item.value} onChange={(e)=>onChange({ ...item, value:e.target.value })} className="w-full bg-background px-2 py-1 rounded border border-border text-sm" />
      </div>
      <div className="text-[11px] text-muted-foreground">Tip: Env items here are stored locally (browser). Do not paste real secrets you wouldn’t store in localStorage.</div>
    </div>
  );
}

// Helpers
function insertMissingVarsFromTemplate(prompt, updatePrompt) {
  const vars = detectTemplateVariables(prompt.template || '');
  const missing = vars.filter(v => !(prompt.variables||[]).some(vv => vv.name === v));
  if (missing.length) updatePrompt({ ...prompt, variables: [ ...prompt.variables||[], ...missing.map(n=>({ name:n, example:'' })) ]});
}

function buildPreview(prompt, values) {
  const base = Object.fromEntries((prompt.variables||[]).map(v=>[v.name, v.example]));
  const merged = { ...base, ...(values||{}) };
  return (prompt.template || '').replace(/\{([a-zA-Z0-9_\.]+)\}/g, (_,k)=> merged[k] ?? `{${k}}`);
}

function mergeEnv(existing, added) {
  const map = new Map(existing.map(e => [e.key, e]));
  (added||[]).forEach(e => map.set(e.key, e));
  return Array.from(map.values());
}

// Indexes view
import { useEffect as useEffectReact, useState as useStateReact } from 'react';
import { authenticatedFetch, api } from '../utils/api';

function IndexesView() {
  const [items, setItems] = useStateReact([]);
  const [selected, setSelected] = useStateReact(null);
  const [bundle, setBundle] = useStateReact('');
  const [showForm, setShowForm] = useStateReact(false);
  const [url, setUrl] = useStateReact('');
  const [name, setName] = useStateReact('');
  const [branch, setBranch] = useStateReact('main');
  const [busy, setBusy] = useStateReact(false);
  const [audioUrl, setAudioUrl] = useStateReact('');
  const [summarizing, setSummarizing] = useStateReact(false);
  const [summaryText, setSummaryText] = useStateReact('');
  const [speaking, setSpeaking] = useStateReact(false);
  const [status, setStatus] = useStateReact(null); // { type: 'running'|'success'|'error', message }

  const load = async () => {
    try { const r = await authenticatedFetch('/api/indexer'); if (r.ok) setItems(await r.json()); } catch {}
  };
  useEffectReact(() => { load(); }, []);

  const loadBundle = async (id) => {
    try { const r = await authenticatedFetch(`/api/indexer/${id}/bundle`); if (r.ok) setBundle(await r.text()); else setBundle(''); } catch { setBundle(''); }
  };

  return (
    <div className="flex-1 min-h-0 flex relative">
      {/* Floating status toast */}
      {status && (
        <div className={`fixed top-3 right-3 z-50 px-3 py-2 rounded-lg shadow-lg border text-xs flex items-center gap-2 transition-opacity ${
          status.type === 'running' ? 'bg-yellow-500/10 text-yellow-200 border-yellow-600' :
          status.type === 'success' ? 'bg-green-500/10 text-green-200 border-green-600' :
          'bg-red-500/10 text-red-200 border-red-600'
        }`}>
          {status.type === 'running' && (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
          )}
          <span>{status.message}</span>
        </div>
      )}
      <div className="w-72 border-r border-border overflow-auto p-3 space-y-3">
        <div className="rounded-xl border border-border bg-muted/10 p-3">
          {!showForm ? (
            <button className="w-full text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground" onClick={()=>setShowForm(true)}>Index from GitHub URL</button>
          ) : (
            <div className="space-y-1">
              <input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="w-full bg-background px-2 py-1.5 rounded border border-border text-xs" />
              <div className="flex gap-1">
                <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="name (optional)" className="flex-1 bg-background px-2 py-1.5 rounded border border-border text-xs" />
                <input value={branch} onChange={(e)=>setBranch(e.target.value)} placeholder="branch" className="w-24 bg-background px-2 py-1.5 rounded border border-border text-xs" />
              </div>
              <div className="flex gap-1">
                <button disabled={busy || !url} className="flex-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50" onClick={async()=>{
                  setBusy(true);
                  try { const r = await api.indexer.github(url, name || undefined, branch || undefined); if (r.ok) { await load(); setShowForm(false); setUrl(''); setName(''); } else { alert('Failed to index'); } } catch(e){ alert('Failed: '+(e?.message||'error')); } finally { setBusy(false); }
                }}>Index</button>
                <button className="text-xs px-2 py-1.5 rounded bg-background border border-border" onClick={()=>{ setShowForm(false); setUrl(''); setName(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        {items.map(i => (
          <div key={i.id}
            className={`rounded-xl border ${selected?.id===i.id?'border-primary/60 bg-muted/30':'border-border bg-muted/10 hover:bg-muted/20'} p-3 transition-colors cursor-pointer`}
            onClick={()=>{ setSelected(i); loadBundle(i.id); }}
          >
            <div className="text-base font-semibold truncate">{i.id}</div>
            <div className="text-[11px] text-muted-foreground truncate">{i.fileCount || 0} files</div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-muted-foreground">No indexes yet. Abra Projects → Index repo.</div>}
      </div>
      <div className="flex-1 p-2 overflow-auto">
        {selected ? (
          <div className="space-y-2">
            <div className="text-sm">Indexed repo: <span className="text-muted-foreground">{selected.repoPath}</span></div>
            <div className="flex flex-wrap gap-2">
              <button className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground" onClick={async()=>{ try { await navigator.clipboard.writeText(bundle); } catch {} }}>Copy bundle</button>
              <button className="text-xs px-2 py-1 rounded bg-background border border-border" onClick={async()=>{ try { const r=await authenticatedFetch(`/api/indexer/${selected.id}`,{}); const j=await r.json(); await navigator.clipboard.writeText(JSON.stringify(j)); } catch {} }}>Copy JSON</button>
              {/* Step 1: summarize (text) */}
              <button
                className={`text-xs px-2 py-1 rounded inline-flex items-center gap-2 ${summarizing ? 'bg-muted text-muted-foreground' : 'bg-background border border-border hover:bg-accent'}`}
                disabled={summarizing || !bundle}
                onClick={async ()=>{
                  try {
                    setSummarizing(true); setSummaryText(''); setAudioUrl('');
                    setStatus({ type: 'running', message: 'Gerando resumo…' });
                    const resp = await authenticatedFetch('/api/ai/summarize', {
                      method: 'POST', body: JSON.stringify({ text: bundle })
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data?.error || 'Failed to summarize');
                    setSummaryText(data.summary || '');
                    setStatus({ type: 'success', message: 'Resumo gerado com sucesso' });
                    setTimeout(() => setStatus(null), 2500);
                  } catch (e) {
                    console.error(e);
                    setStatus({ type: 'error', message: 'Falha ao gerar resumo' });
                    setTimeout(() => setStatus(null), 3000);
                  } finally { setSummarizing(false); }
                }}
                title="Gerar resumo (texto) com Gemini 2.5 Flash"
              >
                {summarizing && (<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />)}
                <span>{summarizing ? 'Summarizing…' : 'Summarize'}</span>
              </button>
              {/* Step 2: speak summary */}
              <button
                className={`text-xs px-2 py-1 rounded inline-flex items-center gap-2 ${speaking || !summaryText ? 'bg-muted text-muted-foreground' : 'bg-background border border-border hover:bg-accent'}`}
                disabled={speaking || !summaryText}
                onClick={async ()=>{
                  try {
                    setSpeaking(true); setAudioUrl('');
                    setStatus({ type: 'running', message: 'Gerando áudio…' });
                    const resp = await authenticatedFetch('/api/tts/gemini-summarize', {
                      method: 'POST', body: JSON.stringify({ text: summaryText, voiceName: 'Zephyr', maxSeconds: 60 })
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data?.error || 'Failed to synthesize');
                    setAudioUrl(data.url);
                    setStatus({ type: 'success', message: 'Áudio gerado' });
                    setTimeout(() => setStatus(null), 2500);
                  } catch (e) {
                    console.error(e);
                    setStatus({ type: 'error', message: 'Falha ao gerar áudio' });
                    setTimeout(() => setStatus(null), 3000);
                  } finally { setSpeaking(false); }
                }}
                title="Ouvir resumo (TTS)"
              >
                {speaking && (<span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />)}
                <span>{speaking ? 'Speaking…' : 'Speak'}</span>
              </button>
            </div>
            {summaryText && (
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <div className="text-xs font-semibold mb-1">Resumo</div>
                <div className="text-xs whitespace-pre-wrap">{summaryText}</div>
              </div>
            )}
            {audioUrl && (
              <div className="rounded-xl border border-border bg-muted/10 p-3 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v2"/></svg>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              <div className="text-xs font-semibold mb-1">Bundle</div>
              <pre className="p-2 bg-black/60 rounded border border-border text-xs whitespace-pre-wrap">{bundle || 'Select an index to view the bundle'}</pre>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select an index</div>
        )}
      </div>
    </div>
  );
}
