import React from 'react';
import { cn } from '../../lib/utils';

export function TextShimmer({
  children,
  className,
  duration = 1.5,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r bg-clip-text text-transparent',
        className
      )}
      style={{
        animation: `shimmer ${duration}s linear infinite`,
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.1) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
      {...props}
    >
      {children}
    </span>
  );
}