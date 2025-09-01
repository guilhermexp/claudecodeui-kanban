import { useEffect } from 'react';

// Injects element selection overlay into iframe and listens for selection messages
export function useElementSelection({ iframeRef, enabled, onSelected, onToggleOff }) {
  useEffect(() => {
    if (!enabled || !iframeRef.current) return;

    const handleElementSelected = (event) => {
      if (event.data?.type === 'element-selected') {
        onSelected?.(event.data.data);
        onToggleOff?.();
        if (window.selectedElementContext !== undefined) {
          window.selectedElementContext = event.data.data;
        }
      }
    };
    window.addEventListener('message', handleElementSelected);

    const timer = setTimeout(() => {
      if (!iframeRef.current) return;
      const iframe = iframeRef.current;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;
        if (iframeDoc.querySelector('#element-selector-script')) return;

        const script = iframeDoc.createElement('script');
        script.id = 'element-selector-script';
        script.textContent = getSelectionScript();
        iframeDoc.head ? iframeDoc.head.appendChild(script) : iframeDoc.documentElement.appendChild(script);
      } catch {}
    }, 400);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleElementSelected);
    };
  }, [enabled, iframeRef, onSelected, onToggleOff]);
}

function getSelectionScript() {
  return `
    (function() {
      try {
        document.body.style.cursor = 'crosshair';
        let hoveredElement = null;
        const styleId = 'element-selector-highlight-styles';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = ` + "`" + `
            .element-selector-hover { outline: 2px solid #3b82f6 !important; outline-offset: 2px !important; background-color: rgba(59,130,246,.1) !important; cursor: crosshair !important; position: relative !important; }
            .element-selector-hover::after { content: attr(data-selector-info) !important; position: absolute !important; bottom: 100% !important; left: 0 !important; background: #3b82f6 !important; color: #fff !important; padding: 4px 8px !important; border-radius: 4px !important; font-size: 12px !important; white-space: nowrap !important; z-index: 10000 !important; pointer-events: none !important; margin-bottom: 4px !important; font-family: monospace !important; }
            .element-selector-hover * { cursor: crosshair !important; }
          ` + "`" + `;
          document.head.appendChild(style);
        }
        const handleMouseMove = (e) => {
          const el = e.target;
          if (hoveredElement && hoveredElement !== el) {
            hoveredElement.classList.remove('element-selector-hover');
            hoveredElement.removeAttribute('data-selector-info');
          }
          if (el && el !== document.body && el !== document.documentElement) {
            el.classList.add('element-selector-hover');
            const info = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c => c && !c.includes('element-selector')).join('.') : '');
            el.setAttribute('data-selector-info', info);
            hoveredElement = el;
          }
        };
        const handleClick = (e) => {
          e.preventDefault(); e.stopPropagation();
          const el = e.target; const rect = el.getBoundingClientRect();
          const path = [];
          let current = el;
          while (current && current !== document.body && path.length < 8) {
            const tag = current.tagName ? current.tagName.toLowerCase() : 'unknown';
            const id = current.id || null;
            const classes = (current.className && typeof current.className === 'string') ? current.className.split(' ').filter(Boolean) : [];
            path.push({ tag, id, classes });
            current = current.parentElement;
          }
          const payload = { html: el.outerHTML || '', text: el.textContent || '',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : ''),
            path };
          parent.postMessage({ type: 'element-selected', data: payload }, '*');
          cleanup();
        };
        const cleanup = () => {
          try {
            document.body.style.cursor = '';
            document.querySelectorAll('.element-selector-hover').forEach(el => { el.classList.remove('element-selector-hover'); el.removeAttribute('data-selector-info'); });
            document.body.removeEventListener('mousemove', handleMouseMove, true);
            document.body.removeEventListener('click', handleClick, true);
            const style = document.getElementById('element-selector-highlight-styles'); if (style) style.remove();
          } catch {}
        };
        document.body.addEventListener('mousemove', handleMouseMove, true);
        document.body.addEventListener('click', handleClick, true);
      } catch {}
    })();
  `;
}

