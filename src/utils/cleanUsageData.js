// Utility to clean usage data and force reimport
export const cleanUsageData = () => {
  // Clear localStorage caches
  localStorage.removeItem('lastUsageImport');
  localStorage.removeItem('cachedUsageStats');
  
  console.log('Usage data cache cleared. Will reimport on next load.');
  
  // Reload the page to trigger fresh import
  window.location.reload();
};

// Auto-execute if called directly
if (typeof window !== 'undefined') {
  window.cleanUsageData = cleanUsageData;
}