// Console injector script for preview iframe
// This script is injected into the preview iframe to capture console messages

(function() {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  // Helper to safely stringify objects
  function safeStringify(obj) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, function(key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        if (value instanceof Error) {
          return {
            message: value.message,
            stack: value.stack,
            name: value.name
          };
        }
        return value;
      });
    } catch (e) {
      return String(obj);
    }
  }

  // Override console methods
  ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
    console[method] = function(...args) {
      // Call original method
      originalConsole[method].apply(console, args);
      
      // Send message to parent window
      try {
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            return safeStringify(arg);
          }
          return String(arg);
        }).join(' ');

        window.parent.postMessage({
          type: 'console-message',
          level: method,
          message: message,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }, '*');
      } catch (e) {
        // Silently fail if postMessage fails
      }
    };
  });

  // Capture unhandled errors
  window.addEventListener('error', function(event) {
    try {
      window.parent.postMessage({
        type: 'console-message',
        level: 'error',
        message: event.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
      }, '*');
    } catch (e) {
      // Silently fail
    }
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    try {
      window.parent.postMessage({
        type: 'console-message',
        level: 'error',
        message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason || 'Unknown'),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        stack: event.reason?.stack
      }, '*');
    } catch (e) {
      // Silently fail
    }
  });

  // Notify parent that console capture is ready
  window.parent.postMessage({
    type: 'console-capture-ready',
    timestamp: new Date().toISOString()
  }, '*');
})();