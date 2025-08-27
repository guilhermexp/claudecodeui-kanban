// Toolbar initialization wrapper
import config from '@stagewise/toolbar/config';

// Wait for the toolbar container to be available
const initToolbar = () => {
  const container = document.getElementById('stagewise-toolbar-app');
  
  if (!container) {
    console.error('Stagewise toolbar container not found');
    return;
  }
  
  // Import the main toolbar script
  import('/toolbar/index.js').then(() => {
    console.log('Stagewise toolbar loaded and initialized');
  }).catch(err => {
    console.error('Failed to load Stagewise toolbar:', err);
  });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolbar);
} else {
  initToolbar();
}

export default config;