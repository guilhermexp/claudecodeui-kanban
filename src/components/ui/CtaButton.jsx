import React from 'react';

export default function CtaButton({ onClick, disabled = false, children, className = '', icon = true, variant = 'default', size = 'sm' }) {
  const base = 'inline-flex items-center gap-1.5 transition-colors disabled:opacity-60';
  const variants = {
    default: 'bg-white text-black hover:bg-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.2)]',
    muted: 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm ring-1 ring-white/10',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_14px_rgba(16,185,129,0.25)]',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-[0_4px_14px_rgba(239,68,68,0.25)]'
  };
  const sizes = {
    xs: 'px-2.5 py-1 text-xs rounded-lg',
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size] || sizes.sm} ${variants[variant] || variants.default} ${className}`}
    >
      {icon && (<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>)}
      {children}
    </button>
  );
}
