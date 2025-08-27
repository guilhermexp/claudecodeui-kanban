/**
 * Proxy server that serves user app with injected Stagewise selection functionality
 * This allows us to bypass cross-origin restrictions and enable element selection
 */

import express from 'express';
import httpProxy from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5556;
const USER_APP_PORT = 5173;

// Selection script that will be injected into every HTML response
const SELECTION_SCRIPT = `
<script>
(function() {
  let selectedElement = null;
  let highlightBox = null;
  let isSelectionMode = false;
  
  // Create highlight box
  function createHighlightBox() {
    if (highlightBox) return;
    highlightBox = document.createElement('div');
    highlightBox.id = 'stagewise-highlight-box';
    highlightBox.style.cssText = \`
      position: absolute;
      border: 2px solid #667eea;
      background: rgba(102, 126, 234, 0.1);
      pointer-events: none;
      z-index: 999999;
      transition: all 0.2s ease;
      display: none;
    \`;
    document.body.appendChild(highlightBox);
  }
  
  // Update highlight box position
  function updateHighlightBox(element) {
    if (!highlightBox || !element) return;
    const rect = element.getBoundingClientRect();
    highlightBox.style.left = rect.left + window.scrollX + 'px';
    highlightBox.style.top = rect.top + window.scrollY + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';
    highlightBox.style.display = 'block';
  }
  
  // Get element selector
  function getElementSelector(element) {
    if (element.id) return '#' + element.id;
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c).join('.');
      if (classes) return element.tagName.toLowerCase() + '.' + classes;
    }
    return element.tagName.toLowerCase();
  }
  
  // Get element info
  function getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      selector: getElementSelector(element),
      text: element.textContent?.substring(0, 100),
      attributes: {
        id: element.id,
        class: element.className,
        href: element.href,
        src: element.src
      },
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    };
  }
  
  // Handle mouseover
  function handleMouseOver(e) {
    if (!isSelectionMode) return;
    e.stopPropagation();
    updateHighlightBox(e.target);
  }
  
  // Handle click
  function handleClick(e) {
    if (!isSelectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    selectedElement = e.target;
    const elementInfo = getElementInfo(selectedElement);
    
    // Send to parent
    window.parent.postMessage({
      type: 'elementSelected',
      element: elementInfo
    }, '*');
    
    // Visual feedback
    highlightBox.style.border = '3px solid #48bb78';
    setTimeout(() => {
      highlightBox.style.border = '2px solid #667eea';
    }, 300);
  }
  
  // Handle mouseleave
  function handleMouseLeave(e) {
    if (!isSelectionMode || !highlightBox) return;
    highlightBox.style.display = 'none';
  }
  
  // Enable selection mode
  function enableSelectionMode() {
    isSelectionMode = true;
    createHighlightBox();
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    
    // Add selection mode styles
    const style = document.createElement('style');
    style.id = 'stagewise-selection-styles';
    style.textContent = \`
      * { cursor: crosshair !important; }
      a { pointer-events: none !important; }
    \`;
    document.head.appendChild(style);
  }
  
  // Disable selection mode
  function disableSelectionMode() {
    isSelectionMode = false;
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    
    // Remove highlight box
    if (highlightBox) {
      highlightBox.style.display = 'none';
    }
    
    // Remove selection styles
    const style = document.getElementById('stagewise-selection-styles');
    if (style) style.remove();
  }
  
  // Listen for messages from parent
  window.addEventListener('message', (event) => {
    if (event.data.type === 'enableSelection') {
      enableSelectionMode();
    } else if (event.data.type === 'disableSelection') {
      disableSelectionMode();
    }
  });
  
  // Notify parent that script is loaded
  window.parent.postMessage({ type: 'selectionScriptReady' }, '*');
})();
</script>
`;

// Middleware to inject selection script into HTML responses
function injectSelectionScript(proxyRes, req, res) {
  const contentType = proxyRes.headers['content-type'];
  if (contentType && contentType.includes('text/html')) {
    let body = '';
    
    // Remove content-length header since we're modifying the response
    delete proxyRes.headers['content-length'];
    
    proxyRes.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    proxyRes.on('end', () => {
      // Inject our script before closing body tag
      const modifiedBody = body.replace('</body>', SELECTION_SCRIPT + '</body>');
      res.end(modifiedBody);
    });
  } else {
    // For non-HTML responses, pipe directly
    proxyRes.pipe(res);
  }
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Serve the toolbar HTML
app.get('/toolbar', (req, res) => {
  res.sendFile(path.join(__dirname, 'proxy-toolbar.html'));
});

// Proxy all other requests to user app with script injection
app.use('/', httpProxy.createProxyMiddleware({
  target: `http://localhost:${USER_APP_PORT}`,
  changeOrigin: true,
  selfHandleResponse: true,
  onProxyRes: injectSelectionScript,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy toolbar server running at http://localhost:${PORT}`);
  console.log(`Proxying user app from http://localhost:${USER_APP_PORT}`);
  console.log(`Toolbar available at http://localhost:${PORT}/toolbar`);
});