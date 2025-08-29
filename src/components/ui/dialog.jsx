import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
};

const DialogContent = React.forwardRef(({ className, children, onOpenChange, ...props }, ref) => {
  const dialogRef = useRef(null);
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onOpenChange) {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onOpenChange]);

  return (
    <div
      ref={ref || dialogRef}
      className={cn(
        "relative bg-black/95 rounded-xl border border-[#1a1a1a] max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {/* Close button */}
      {onOpenChange && (
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>
  );
});

DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, children, ...props }) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  >
    {children}
  </div>
);

const DialogTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </h2>
));

DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  >
    {children}
  </p>
));

DialogDescription.displayName = 'DialogDescription';

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };