import { useEffect, useRef, useState } from 'react';

// Handles console-message postMessages from the preview iframe and script injection for capture
export function useConsoleCapture({ iframeRef, isPaused, currentUrl, logs, setLogs }) {
  const [captureReady, setCaptureReady] = useState(false);
  const captureReadyTimer = useRef(null);

  // Listen to window postMessage for console-message and capture-ready
  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const origin = new URL(event.origin);
        const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
        if (!validHosts.includes(origin.hostname)) return;
      } catch { return; }

      if (event.data?.type === 'console-message') {
        const raw = String(event.data.message || '');
        const low = raw.toLowerCase();
        if (raw.includes('[vite]') || raw.includes('[HMR]') || low.includes('websocket') || low.includes('connecting') || low.includes('connected')) return;

        const { level, message, timestamp, url, filename, line, column, stack } = event.data;
        const logEntry = {
          type: level,
          message: message || 'Unknown message',
          timestamp: new Date(timestamp).toLocaleTimeString(),
          url, filename, line, column, stack, count: 1
        };
        setLogs(prev => {
          const lastLog = prev[prev.length - 1];
          if (lastLog && lastLog.message === logEntry.message && lastLog.filename === logEntry.filename && lastLog.line === logEntry.line) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...lastLog, count: (lastLog.count || 1) + 1, timestamp: logEntry.timestamp };
            return updated;
          }
          return [...prev.slice(-99), logEntry];
        });
      }

      if (event.data?.type === 'console-capture-ready') {
        setCaptureReady(true);
        if (captureReadyTimer.current) { clearTimeout(captureReadyTimer.current); captureReadyTimer.current = null; }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setLogs]);

  // Inject capture script on iframe load and when URL changes
  useEffect(() => {
    setCaptureReady(false);
    if (captureReadyTimer.current) { clearTimeout(captureReadyTimer.current); captureReadyTimer.current = null; }

    const injectConsoleCapture = () => {
      if (!iframeRef.current || isPaused) return;
      const iframe = iframeRef.current;
      try {
        const performInjection = () => {
          try {
            const iframeWindow = iframe.contentWindow;
            const iframeDocument = iframe.contentDocument || (iframeWindow && iframeWindow.document);
            if (!iframeWindow || !iframeDocument) return;
            if (iframeWindow.__consoleInjected) return;
            iframeWindow.__consoleInjected = true;

            const script = iframeDocument.createElement('script');
            script.src = '/preview-console-injector.js';
            script.async = false;

            const inlineScript = iframeWindow.document.createElement('script');
            inlineScript.textContent = helperSnippet;

            const injectNow = () => {
              try {
                if (!iframeDocument.head) return false;
                iframeDocument.head.appendChild(script);
                iframeDocument.head.appendChild(inlineScript);
                return true;
              } catch { return false; }
            };

            if (!injectNow()) {
              const obs = new MutationObserver(() => { injectNow(); });
              obs.observe(iframeDocument, { childList: true, subtree: true });
              setTimeout(() => { try { obs.disconnect(); } catch {} }, 2000);
            }

            captureReadyTimer.current = setTimeout(() => {
              if (!captureReady) {
                setLogs(prev => ([...prev, { type: 'info', message: 'Cross-origin preview: console capture limited. To capture errors here, run the helper snippet in the app or open with proxy.', timestamp: new Date().toLocaleTimeString() }]));
              }
            }, 1500);
          } catch {}
        };

        if (iframe.contentDocument?.readyState === 'complete') {
          performInjection();
        } else {
          iframe.addEventListener('load', performInjection, { once: true });
        }
      } catch {}
    };

    injectConsoleCapture();

    return () => {
      if (captureReadyTimer.current) { clearTimeout(captureReadyTimer.current); captureReadyTimer.current = null; }
    };
  }, [iframeRef, isPaused, currentUrl, setLogs, captureReady]);

  const helperSnippet = `(() => {try{const send=(m,s)=>parent.postMessage({type:'console-message',level:'error',message:String(m),timestamp:new Date().toISOString(),url:location.href,stack:s},'*');const oe=console.error;console.error=(...a)=>{try{send(a.map(x=>x&&x.message?x.message:typeof x==='object'?JSON.stringify(x):String(x)).join(' '),a[0]&&a[0].stack);}catch{}oe.apply(console,a)};addEventListener('error',e=>{try{send(e.message,e.error&&e.error.stack)}catch{}});addEventListener('unhandledrejection',e=>{try{send('Unhandled Promise Rejection: '+(e.reason&&e.reason.message?e.reason.message:String(e.reason)),e.reason&&e.reason.stack)}catch{}});parent.postMessage({type:'console-capture-ready'},'*')}catch{}})();`;

  const clearLogs = () => setLogs([]);

  const refreshLogs = () => {
    setLogs([]);
    if (iframeRef.current) { iframeRef.current.src = iframeRef.current.src; }
  };

  const copyLogsToClipboard = async () => {
    const errorText = logs.map(log => {
      const count = log.count > 1 ? ` (${log.count}×)` : '';
      const location = log.filename ? `\n  File: ${log.filename}:${log.line}:${log.column}` : '';
      const stack = log.stack ? `\n  Stack: ${log.stack}` : '';
      return `ERROR${count}: ${log.message}${location}${stack}`;
    }).join('\n\n');
    if (!errorText) { alert('No errors to copy'); return; }
    await navigator.clipboard.writeText(errorText).catch(() => alert('Failed to copy to clipboard'));
  };

  return { captureReady, helperSnippet, clearLogs, refreshLogs, copyLogsToClipboard };
}

