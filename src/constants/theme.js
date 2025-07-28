// Centralized theme configuration for consistent dark mode
export const darkTheme = {
  // Background colors - from darkest to lightest
  bg: {
    primary: 'bg-gray-900',      // Main background
    secondary: 'bg-gray-800',    // Panels, cards
    tertiary: 'bg-gray-700',     // Hover states, borders
    quaternary: 'bg-gray-600',   // Active states
  },
  
  // Light mode backgrounds
  bgLight: {
    primary: 'bg-white',
    secondary: 'bg-gray-50',
    tertiary: 'bg-gray-100',
    quaternary: 'bg-gray-200',
  },
  
  // Text colors
  text: {
    primary: 'text-gray-100',
    secondary: 'text-gray-300',
    tertiary: 'text-gray-400',
    muted: 'text-gray-500',
  },
  
  textLight: {
    primary: 'text-gray-900',
    secondary: 'text-gray-700',
    tertiary: 'text-gray-600',
    muted: 'text-gray-500',
  },
  
  // Border colors
  border: {
    primary: 'border-gray-700',
    secondary: 'border-gray-600',
    hover: 'border-gray-500',
  },
  
  borderLight: {
    primary: 'border-gray-200',
    secondary: 'border-gray-300',
    hover: 'border-gray-400',
  },
  
  // Component-specific classes
  components: {
    // Main layout
    appBg: 'bg-white dark:bg-gray-900',
    
    // Sidebar
    sidebarBg: 'bg-gray-50 dark:bg-gray-800',
    sidebarBorder: 'border-gray-200 dark:border-gray-700',
    sidebarHover: 'hover:bg-gray-100 dark:hover:bg-gray-700',
    
    // Main content area
    contentBg: 'bg-white dark:bg-gray-900',
    
    // Cards and panels
    cardBg: 'bg-white dark:bg-gray-800',
    cardBorder: 'border-gray-200 dark:border-gray-700',
    cardHover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
    
    // Inputs
    inputBg: 'bg-white dark:bg-gray-800',
    inputBorder: 'border-gray-300 dark:border-gray-600',
    inputFocus: 'focus:border-blue-500 dark:focus:border-blue-500',
    
    // Buttons
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSecondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
    
    // Text
    textPrimary: 'text-gray-900 dark:text-gray-100',
    textSecondary: 'text-gray-700 dark:text-gray-300',
    textMuted: 'text-gray-500 dark:text-gray-400',
    
    // Chat specific
    chatBg: 'bg-white dark:bg-gray-900',
    chatMessageUser: 'bg-blue-50 dark:bg-blue-900/20',
    chatMessageAssistant: 'bg-gray-100 dark:bg-gray-800',
    
    // Code editor
    editorBg: 'bg-gray-900',
    editorBorder: 'border-gray-700',
    
    // Terminal
    terminalBg: 'bg-gray-900',
    terminalText: 'text-gray-100',
    
    // Modal/Dialog
    modalBg: 'bg-white dark:bg-gray-800',
    modalOverlay: 'bg-black/50',
    
    // Tooltips
    tooltipBg: 'bg-gray-900 dark:bg-gray-700',
    tooltipText: 'text-white',
  }
};

// Helper function to get theme classes
export const getThemeClass = (component) => {
  return darkTheme.components[component] || '';
};