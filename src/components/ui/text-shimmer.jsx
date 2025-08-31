import { cn } from '../../lib/utils';

export function TextShimmer({
  children,
  className,
  duration = 1.5,
  // variant controls contrast of the shimmer gradient
  // 'on-dark' (default): light gradient for dark backgrounds
  // 'on-light': dark gradient for light backgrounds (e.g., white buttons)
  variant = 'on-dark',
  ...props
}) {
  const gradient =
    variant === 'on-light'
      ? 'linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.15) 100%)'
      : 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.1) 100%)';
  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r bg-clip-text text-transparent',
        className
      )}
      style={{
        animation: `shimmer ${duration}s linear infinite`,
        backgroundImage: gradient,
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
