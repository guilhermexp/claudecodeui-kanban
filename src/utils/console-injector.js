// Console injection script for preview panel
export const consoleInjectorScript = `
(function() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };
  
  function safeStringify(obj) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, function(key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (value instanceof Error) {
          return { message: value.message, stack: value.stack, name: value.name };
        }
        return value;
      });
    } catch (e) {
      return String(obj);
    }
  }
  
  // Only capture real errors
  ['error'].forEach(method => {
    console[method] = function(...args) {
      originalConsole[method].apply(console, args);
      try {
        const message = args.map(arg => {
          if (typeof arg === 'object') return safeStringify(arg);
          return String(arg);
        }).join(' ');
        
        // Skip noise
        if (!message || message.trim() === '') return;
        if (message.includes('[vite]')) return;
        if (message.includes('[HMR]')) return;
        if (message.includes('WebSocket')) return;
        if (message.toLowerCase().includes('connect')) return;
        
        // Send to parent if safe
        if (window.parent !== window && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          window.parent.postMessage({
            type: 'console-message',
            level: method,
            message: message,
            timestamp: new Date().toISOString(),
            url: window.location.href
          }, '*');
        }
      } catch (e) {}
    };
  });
  
  window.addEventListener('error', function(event) {
    try {
      const msg = event.message || '';
      if (msg.includes('[vite]')) return;
      if (msg.includes('[HMR]')) return;
      if (msg.includes('WebSocket')) return;
      
      if (window.parent !== window && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        window.parent.postMessage({
          type: 'console-message',
          level: 'error',
          message: msg || 'Unknown error',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack
        }, '*');
      }
    } catch (e) {}
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    try {
      const reason = event.reason?.message || event.reason || '';
      if (typeof reason === 'string') {
        if (reason.includes('[vite]')) return;
        if (reason.includes('[HMR]')) return;
        if (reason.includes('WebSocket')) return;
      }
      
      if (window.parent !== window && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        window.parent.postMessage({
          type: 'console-message',
          level: 'error',
          message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason || 'Unknown'),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          stack: event.reason?.stack
        }, '*');
      }
    } catch (e) {}
  });
  
  // Notify parent we're ready
  try {
    if (window.parent !== window && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      window.parent.postMessage({
        type: 'console-capture-ready',
        timestamp: new Date().toISOString()
      }, '*');
    }
  } catch (e) {}
})();
`;