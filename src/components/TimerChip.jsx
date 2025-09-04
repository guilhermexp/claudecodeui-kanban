import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Clock3, Plus, X } from 'lucide-react';
import { addSession } from '../utils/timer-history';

// Minimal, self-contained timer/pomodoro/reminder chip for the header
// States: idle -> ready -> running/paused. Optional label input in edit mode.
// Persists lightweight state in localStorage so it survives refreshes.

const STORAGE_KEY = 'vibe_timer_chip_v1';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function usePersistedState(initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return [state, setState];
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${h}:${mm}:${String(s).padStart(2, '0')}`;
  }
  if (m >= 1) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function ProgressRing({ progress = 0, children }) {
  // SVG circle progress ring (0..1)
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circum = 2 * Math.PI * radius;
  const offset = circum * (1 - clamp(progress, 0, 1));

  return (
    <div className="relative w-7 h-7">
      <svg className="w-7 h-7 rotate-[-90deg]" viewBox={`0 0 ${size} ${size}`}
           aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={radius}
                stroke="rgba(255,255,255,0.3)" strokeWidth={stroke}
                fill="none" />
        <circle cx={size/2} cy={size/2} r={radius}
                stroke="#fff" strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circum}
                strokeDashoffset={offset}
                fill="none" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-white">
        {children}
      </div>
    </div>
  );
}

export default function TimerChip({ projectName }) {
  const [state, setState] = usePersistedState({
    mode: 'idle', // idle | ready | running | paused | edit
    label: '',
    totalMs: 25 * 60 * 1000, // default pomodoro 25m
    remainingMs: 25 * 60 * 1000,
    startedAt: null,
  });

  const rafRef = useRef(null);

  // Sync running time
  useEffect(() => {
    if (state.mode !== 'running') return;
    const tick = () => {
      setState(prev => {
        if (prev.mode !== 'running') return prev;
        const now = Date.now();
        const elapsed = now - (prev.startedAt || now);
        const remainingMs = clamp(prev.totalMs - elapsed, 0, prev.totalMs);
        if (remainingMs <= 0) {
          try {
            addSession({
              project: projectName || 'Standalone',
              label: prev.label,
              start: new Date(prev.startedAt || now).toISOString(),
              end: new Date(now).toISOString(),
              durationMs: prev.totalMs,
            });
          } catch {}
          return { ...prev, mode: 'ready', remainingMs: prev.totalMs, startedAt: null };
        }
        return { ...prev, remainingMs };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [state.mode, setState, projectName]);

  const progress = useMemo(() => {
    if (state.mode === 'running') {
      return 1 - state.remainingMs / state.totalMs;
    }
    if (state.mode === 'paused') {
      return 1 - state.remainingMs / state.totalMs;
    }
    return 0;
  }, [state.mode, state.remainingMs, state.totalMs]);

  const minutesValue = Math.max(1, Math.round(state.totalMs / 60000));

  const start = () => {
    setState(prev => ({
      ...prev,
      mode: 'running',
      startedAt: Date.now(),
      remainingMs: prev.totalMs,
    }));
  };

  const pause = () => {
    setState(prev => ({ ...prev, mode: 'paused' }));
  };

  const resume = () => {
    setState(prev => {
      const now = Date.now();
      const alreadyElapsed = prev.totalMs - prev.remainingMs;
      const startAt = now - alreadyElapsed;
      return { ...prev, mode: 'running', startedAt: startAt };
    });
  };

  const reset = () => {
    setState(prev => {
      // If there is elapsed time, log a partial session before reset
      if ((prev.mode === 'running' || prev.mode === 'paused') && prev.startedAt) {
        try {
          const now = Date.now();
          const elapsed = prev.mode === 'running' ? (now - prev.startedAt) : (prev.totalMs - prev.remainingMs);
          if (elapsed > 15000) {
            addSession({
              project: projectName || 'Standalone',
              label: prev.label,
              start: new Date(prev.startedAt).toISOString(),
              end: new Date(now).toISOString(),
              durationMs: elapsed,
            });
          }
        } catch {}
      }
      return { ...prev, mode: 'ready', remainingMs: prev.totalMs, startedAt: null };
    });
  };

  const clear = () => {
    setState({ mode: 'idle', label: '', totalMs: 25 * 60 * 1000, remainingMs: 25 * 60 * 1000, startedAt: null });
  };

  const setMinutes = (m) => {
    const mm = clamp(Number.isFinite(m) ? Math.round(m) : 25, 1, 12 * 60);
    const ms = mm * 60 * 1000;
    setState(prev => ({ ...prev, totalMs: ms, remainingMs: ms }));
  };

  // Glass styles reused for the chip and controls
  const glass = 'bg-background/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-inner';

  return (
    <div className="flex items-center gap-1.5 select-none text-xs">
      {/* Left small button: X (cancel/clear) or + (create) */}
      {state.mode === 'idle' ? (
        <button
          onClick={() => setState(s => ({ ...s, mode: 'ready' }))}
          className={`h-7 w-7 rounded-[10px] ${glass} text-foreground/80 hover:text-foreground flex items-center justify-center`}
          aria-label="Create timer"
          title="Create timer"
        >
          <Plus className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => (state.mode === 'running' || state.mode === 'paused') ? reset() : clear()}
          className={`h-7 w-7 rounded-[10px] ${glass} text-foreground/80 hover:text-foreground flex items-center justify-center`}
          aria-label={state.mode === 'running' || state.mode === 'paused' ? 'Reset timer' : 'Clear timer'}
          title={state.mode === 'running' || state.mode === 'paused' ? 'Reset timer' : 'Clear timer'}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Running badge */}
      {(state.mode === 'running' || state.mode === 'paused') && (
        <div className="relative">
          <div className="rounded-full bg-black/25">
            <ProgressRing progress={progress}>
              <span className="drop-shadow-sm">{Math.max(0, Math.round(state.remainingMs / 60000))}</span>
            </ProgressRing>
          </div>
          {/* small x to clear */}
          <button
            onClick={reset}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/60 text-white grid place-items-center"
            aria-label="Reset timer"
            title="Reset timer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main pill */}
      <div className={`h-7 px-2.5 flex items-center gap-1.5 rounded-[14px] ${glass} text-xs text-foreground/90`}
           role={state.mode === 'running' ? 'timer' : undefined}
           aria-live={state.mode === 'running' ? 'polite' : undefined}
      >
        <Clock3 className="w-3.5 h-3.5 opacity-70" />
        {/* Edit/Display duration */}
        {state.mode === 'idle' ? (
          <span className="opacity-70">Timer</span>
        ) : (
          <>
            {state.mode === 'ready' || state.mode === 'paused' ? (
              <button
                onClick={() => setState(s => ({ ...s, mode: 'edit' }))}
                className="px-1 py-0.5 rounded hover:bg-white/10"
                title="Edit duration/label"
              >
                {Math.round(state.totalMs / 60000)} min
              </button>
            ) : null}

            {state.mode === 'running' && (
              <span>{formatTime(state.remainingMs)}</span>
            )}

            {state.mode === 'edit' && (
              <EditInline 
                minutes={minutesValue}
                label={state.label}
                onConfirm={(m, l) => setState(s => ({ ...s, mode: 'ready', label: l, totalMs: m*60000, remainingMs: m*60000 }))}
                onCancel={() => setState(s => ({ ...s, mode: 'ready' }))}
              />
            )}

            {/* Spacer when not editing */}
            {state.mode !== 'edit' && (
              <div className="w-px h-3.5 bg-white/15 mx-0.5" />
            )}

            {/* Play/Pause */}
            {state.mode === 'ready' && (
              <button onClick={start} className="hover:opacity-100 opacity-80" aria-label="Start timer">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {state.mode === 'running' && (
              <button onClick={pause} className="hover:opacity-100 opacity-80" aria-label="Pause timer">
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {state.mode === 'paused' && (
              <button onClick={resume} className="hover:opacity-100 opacity-80" aria-label="Resume timer">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EditInline({ minutes, label, onConfirm, onCancel }) {
  const [m, setM] = useState(minutes);
  const [text, setText] = useState(label || '');
  const minRef = useRef(null);

  useEffect(() => { minRef.current?.focus(); }, []);

  const commit = () => {
    const mm = clamp(parseInt(m, 10) || minutes || 25, 1, 12 * 60);
    onConfirm(mm, text.trim());
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={minRef}
        type="number"
        min={1}
        max={720}
        value={m}
        onChange={(e) => setM(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
        className="w-14 h-6 text-[12px] px-2 rounded-md bg-white/10 text-foreground placeholder:text-foreground/60 focus:outline-none"
        placeholder="min"
        aria-label="Minutes"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
        className="w-32 h-6 text-[12px] px-2 rounded-md bg-white/10 text-foreground placeholder:text-foreground/60 focus:outline-none"
        placeholder="Reminder…"
        aria-label="Reminder label"
      />
      <button onClick={commit} className="text-foreground/90 hover:text-foreground" title="Save">OK</button>
    </div>
  );
}
