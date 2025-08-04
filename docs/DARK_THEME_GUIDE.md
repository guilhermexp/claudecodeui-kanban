# Dark Theme Implementation Guide

## Overview
This guide documents the pure black dark theme implementation in Claude Code UI, providing a modern, high-contrast dark mode experience.

## Theme System Architecture

### CSS Variables
The theme system is built on CSS custom properties defined in `src/index.css`:

```css
.dark {
  /* Core Colors */
  --background: 0 0% 0%;              /* Pure black background */
  --foreground: 213 27% 84%;          /* Light grey text */
  --card: 0 0% 8%;                    /* Very dark grey for cards */
  --card-foreground: 213 27% 84%;     /* Light grey text on cards */
  --popover: 0 0% 8%;                 /* Same as card for consistency */
  --popover-foreground: 213 27% 84%;  /* Light grey text */
  
  /* Interactive Elements */
  --primary: 215 13.8% 50.2%;         /* Medium grey instead of blue */
  --primary-foreground: 0 0% 100%;    /* White text on primary */
  --secondary: 0 0% 12%;              /* Dark grey for secondary elements */
  --secondary-foreground: 213 27% 84%; /* Light grey text */
  --muted: 0 0% 12%;                  /* Dark grey for muted elements */
  --muted-foreground: 215 13.8% 50.2%; /* Medium grey text */
  --accent: 0 0% 15%;                 /* Dark grey accent */
  --accent-foreground: 213 27% 84%;   /* Light grey text */
  
  /* UI Elements */
  --border: 0 0% 15%;                 /* Dark grey borders */
  --input: 0 0% 8%;                   /* Very dark grey inputs */
  --ring: 215 13.8% 50.2%;            /* Grey focus ring */
}
```

## Component Implementation

### 1. Main Application (`App.jsx`)
```jsx
// Login modal with pure black theme
<div className="relative bg-white dark:bg-gray-950 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-md mx-4 p-6 space-y-4">
```

### 2. Sidebar (`Sidebar.jsx`)
```jsx
// Project items with black background
isVibeKanbanProject(project) && !isSelected && "bg-gray-100 dark:bg-black/30",
isStarred && !isSelected && isVibeKanbanProject(project) && "bg-gray-200 dark:bg-black/50"

// Hover states
"hover:bg-gray-50 dark:hover:bg-gray-900"
```

### 3. Quick Settings Panel (`QuickSettingsPanel.jsx`)
```jsx
// Main panel background
className={`fixed top-0 right-0 h-full w-64 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800`}

// Settings items
<div className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800">
```

### 4. Mobile Navigation (`MobileNav.jsx`)
```jsx
// Bottom navigation bar
className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800`}
```

## Color Palette

### Background Hierarchy
1. **Pure Black (0%)** - Main application background
2. **Near Black (8%)** - Cards, inputs, popovers
3. **Dark Grey (12%)** - Secondary elements, muted items
4. **Medium Dark (15%)** - Accent colors, borders
5. **Grey (50%)** - Interactive elements when not using brand colors

### Text Colors
- **Primary Text**: `213 27% 84%` - Light grey for main content
- **Muted Text**: `215 13.8% 50.2%` - Medium grey for secondary content
- **White**: `0 0% 100%` - Used on primary buttons and high contrast areas

## Implementation Guidelines

### 1. Background Usage
```jsx
// Primary background - use for main containers
className="bg-background"  // or dark:bg-black

// Card backgrounds - use for elevated surfaces
className="bg-card"  // or dark:bg-gray-900

// Interactive backgrounds - use for hover states
className="hover:bg-accent"  // or dark:hover:bg-gray-800
```

### 2. Border Colors
```jsx
// Standard borders
className="border-border"  // or dark:border-gray-800

// Subtle borders
className="border-gray-200 dark:border-gray-900"

// Interactive borders
className="hover:border-gray-300 dark:hover:border-gray-700"
```

### 3. Transparency Usage
```jsx
// Subtle overlays
className="dark:bg-black/30"  // 30% opacity black

// Medium overlays
className="dark:bg-black/50"  // 50% opacity black

// Strong overlays
className="dark:bg-black/80"  // 80% opacity black
```

## Best Practices

### 1. Contrast Ratios
- Ensure text on black backgrounds maintains WCAG AA compliance
- Use `text-gray-300` or lighter for body text on pure black
- Use `text-white` for headings and important elements

### 2. Visual Hierarchy
- Use elevation through lighter backgrounds, not shadows
- Reserve pure black for the main background only
- Use `bg-gray-900` for cards and elevated surfaces
- Use `bg-gray-800` for hover states

### 3. Consistency
- Always pair light and dark mode classes
- Use Tailwind's dark: prefix consistently
- Test both themes when making changes

### 4. Performance
- Use CSS variables for dynamic theming
- Leverage Tailwind's JIT compiler for optimal bundle size
- Avoid inline styles for theme-dependent colors

## Migration Guide

### Converting Existing Components
1. Replace `dark:bg-gray-800` with `dark:bg-gray-900` for cards
2. Replace `dark:bg-gray-900` with `dark:bg-black` for main backgrounds
3. Update hover states from `dark:hover:bg-gray-700` to `dark:hover:bg-gray-800`
4. Adjust borders from `dark:border-gray-700` to `dark:border-gray-800`

### Example Migration
```jsx
// Before
<div className="bg-white dark:bg-gray-800 border dark:border-gray-700">

// After
<div className="bg-white dark:bg-gray-900 border dark:border-gray-800">
```

## Theme Toggle Integration

The theme system integrates with the `ThemeContext` and `DarkModeToggle` component:

```jsx
import { useTheme } from '../contexts/ThemeContext';

const { isDarkMode, toggleDarkMode } = useTheme();
```

## Accessibility Considerations

1. **Color Contrast**: All text colors meet WCAG AA standards against black backgrounds
2. **Focus Indicators**: High contrast focus rings are maintained in dark mode
3. **Reduced Motion**: Theme transitions respect `prefers-reduced-motion`
4. **System Preference**: Automatically detects and applies system dark mode preference

## Testing Checklist

- [ ] Toggle between light and dark modes
- [ ] Verify all text is readable in dark mode
- [ ] Check hover states and interactive elements
- [ ] Test on different screen sizes
- [ ] Validate in different browsers
- [ ] Check print styles (should use light theme)

## Future Enhancements

1. **Custom Theme Colors**: Allow users to customize accent colors
2. **Contrast Modes**: High contrast and reduced contrast options
3. **Theme Presets**: Multiple dark theme variations (grey, blue-grey, true black)
4. **Automatic Theme Switching**: Time-based or ambient light-based switching