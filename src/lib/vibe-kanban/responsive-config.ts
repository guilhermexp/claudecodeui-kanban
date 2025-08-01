/**
 * Centralized responsive configuration for TaskDetailsPanel
 * Adjust these values to change when the panel switches between overlay and side-by-side modes
 */

// The breakpoint at which we switch from overlay to side-by-side mode
// Change this value to adjust when the panel switches to side-by-side mode:
// 'sm' = 640px, 'md' = 768px, 'lg' = 1024px, 'xl' = 1280px, '2xl' = 1536px
export const PANEL_SIDE_BY_SIDE_BREAKPOINT = 'xl' as const;

// Panel widths for different screen sizes (in overlay mode)
export const PANEL_WIDTHS = {
  base: 'w-full max-h-screen', // < 640px - full width with constrained height
  sm: 'sm:w-[95vw] sm:max-w-[540px] sm:max-h-[85vh]', // 640px+ - more space on mobile
  md: 'md:w-[85vw] md:max-w-[600px] md:max-h-[90vh]', // 768px+
  lg: 'lg:w-[75vw] lg:max-w-[650px] lg:max-h-[92vh]', // 1024px+
  xl: 'xl:w-[60vw] xl:max-w-[750px] xl:max-h-[95vh]', // 1280px+
  '2xl': '2xl:w-[50vw] 2xl:max-w-[800px] 2xl:max-h-full', // 1536px+ (side-by-side mode)
} as const;

// Generate classes for TaskDetailsPanel
export const getTaskPanelClasses = () => {
  const overlayClasses = [
    'fixed inset-y-0 right-0 z-50',
    PANEL_WIDTHS.base,
    PANEL_WIDTHS.sm,
    PANEL_WIDTHS.md,
    PANEL_WIDTHS.lg,
    PANEL_WIDTHS.xl,
  ].join(' ');

  const sideBySideClasses = [
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:relative`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:inset-auto`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:z-auto`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:h-full`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:w-[800px]`,
  ].join(' ');

  return `${overlayClasses} ${sideBySideClasses} bg-background border-l shadow-lg flex flex-col overflow-hidden rounded-l-lg sm:rounded-l-xl`;
};

// Generate classes for backdrop (only show in overlay mode)
export const getBackdropClasses = () => {
  return `fixed inset-0 z-40 bg-black/50 backdrop-blur-sm ${PANEL_SIDE_BY_SIDE_BREAKPOINT}:hidden transition-opacity duration-200`;
};

// Generate classes for main container (enable flex layout in side-by-side mode)
export const getMainContainerClasses = (isPanelOpen: boolean) => {
  if (!isPanelOpen) return 'w-full';

  return `w-full ${PANEL_SIDE_BY_SIDE_BREAKPOINT}:flex ${PANEL_SIDE_BY_SIDE_BREAKPOINT}:h-full`;
};

// Generate classes for kanban section
export const getKanbanSectionClasses = (isPanelOpen: boolean) => {
  if (!isPanelOpen) return 'w-full';

  // Remove opacity and pointer-events for mobile to fix transparency issue
  const overlayClasses = 'w-full';
  const sideBySideClasses = [
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:flex-1`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:min-w-0`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:h-full`,
    `${PANEL_SIDE_BY_SIDE_BREAKPOINT}:overflow-y-auto`,
  ].join(' ');

  return `${overlayClasses} ${sideBySideClasses}`;
};
