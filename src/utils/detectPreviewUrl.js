/**
 * Smart detection of the best URL to use for preview
 * Priority order:
 * 1. Ngrok tunnel (production)
 * 2. Network IP (for testing from other devices)
 * 3. Localhost (development)
 */

export async function detectBestPreviewUrl() {
  // Check if we're already running from ngrok
  if (window.location.hostname.includes('ngrok.app')) {
    return window.location.origin;
  }

  // Check if running from network IP
  if (window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1' && 
      !window.location.hostname.includes('::1')) {
    return window.location.origin;
  }

  // Try to detect ngrok tunnel via API
  try {
    const response = await fetch('http://localhost:4040/api/tunnels', {
      signal: AbortSignal.timeout(1000) // 1 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      const tunnel = data.tunnels?.find(t => 
        t.config?.addr?.includes('7347') || // Production port
        t.config?.addr?.includes('5892')    // Development port
      );
      
      if (tunnel?.public_url) {
        // Prefer HTTPS over HTTP
        const httpsUrl = tunnel.public_url.replace('http://', 'https://');
        return httpsUrl;
      }
    }
  } catch (e) {
    // Ngrok API not available, continue with fallbacks
  }

  // Check for known ngrok domain in production
  if (window.location.port === '7347') {
    // Try the known production ngrok domain
    try {
      const testResponse = await fetch('https://claudecode.ngrok.app/api/health', {
        signal: AbortSignal.timeout(2000),
        mode: 'no-cors' // Just check if reachable
      });
      return 'https://claudecode.ngrok.app';
    } catch (e) {
      // Production ngrok not available
    }
  }

  // Default to current development server
  const port = window.location.port || '5892';
  return `http://localhost:${port}`;
}

/**
 * Get network IP address (useful for mobile testing)
 */
export async function getNetworkUrl() {
  try {
    // Try to get from server endpoint
    const response = await fetch('/api/network-info');
    if (response.ok) {
      const data = await response.json();
      if (data.networkIP) {
        const port = window.location.port || '5892';
        return `http://${data.networkIP}:${port}`;
      }
    }
  } catch (e) {
    // Server endpoint not available
  }
  
  // Fallback to current location if on network
  if (window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  
  return null;
}