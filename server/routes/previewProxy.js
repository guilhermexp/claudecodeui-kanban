import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { getPreviewProxyInfo } from '../lib/previewManager.js';

function encodeProjectSegment(projectName) {
  return encodeURIComponent(projectName);
}

function extractForwardPath(basePrefix, originalUrl) {
  if (!originalUrl.startsWith(basePrefix)) return '/';
  const rest = originalUrl.slice(basePrefix.length);
  return rest || '/';
}

function stripFrameAncestors(cspHeader) {
  if (!cspHeader) return cspHeader;
  try {
    const directives = cspHeader.split(';').map(part => part.trim()).filter(Boolean);
    const filtered = directives.filter(d => !/^frame-ancestors/i.test(d));
    return filtered.join('; ');
  } catch {
    return cspHeader;
  }
}

function parsePreviewCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/previewProject=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function extractProjectFromRequest(req) {
  const cookieProject = parsePreviewCookie(req.headers?.cookie);
  if (cookieProject) return cookieProject;

  const referer = req.headers?.referer || req.headers?.origin || '';
  const match = referer.match(/\/preview\/([^/]+)/);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }

  if (req.query?.previewProject) {
    try { return decodeURIComponent(req.query.previewProject); } catch { return req.query.previewProject; }
  }

  if (req.url && req.url.includes('previewProject=')) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const qp = parsed.searchParams.get('previewProject');
      if (qp) return decodeURIComponent(qp);
    } catch {}
  }

  return null;
}

function proxyHttpRequest(port, forwardPath, req, res, projectContext = null) {
  const options = {
    hostname: '127.0.0.1',
    port,
    path: forwardPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${port}`
    }
  };

  // Next dev relies on accurate origin/referer; strip preview prefix
  const basePreviewRegex = /\/preview\/[^/]+/;
  if (options.headers.referer) {
    options.headers.referer = options.headers.referer.replace(basePreviewRegex, '');
  }
  if (options.headers.origin) {
    options.headers.origin = options.headers.origin.replace(basePreviewRegex, '');
  }

  const proxyReq = http.request(options, (proxyRes) => {
    let locationHeader = proxyRes.headers.location;
    if (locationHeader && projectContext) {
      const parsed = new URL(locationHeader, `http://localhost:${port}`);
      if (
        parsed.origin === `http://localhost:${port}` ||
        parsed.origin === `https://localhost:${port}`
      ) {
        const encodedSegment = encodeURIComponent(projectContext);
        parsed.hostname = req.headers.host?.split(':')[0] || 'localhost';
        const clientPort = req.headers.host?.split(':')[1] || '';
        if (clientPort) parsed.port = clientPort;
        parsed.protocol = req.protocol + ':';
        parsed.pathname = `/preview/${encodedSegment}${parsed.pathname}`;
        locationHeader = parsed.toString();
      }
    }

    const headers = { ...proxyRes.headers };
    if (headers['content-security-policy']) {
      const sanitized = stripFrameAncestors(headers['content-security-policy']);
      if (sanitized) headers['content-security-policy'] = sanitized;
      else delete headers['content-security-policy'];
    }
    if (locationHeader) {
      headers.location = locationHeader;
    }
    res.writeHead(proxyRes.statusCode ?? 500, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).send(`Preview proxy error: ${err.message}`);
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
  req.on('aborted', () => proxyReq.destroy());
}

function sanitizeStaticPath(relativePath) {
  const normalized = path.posix.normalize(relativePath || '/');
  if (normalized === '/' || normalized === '') return 'index.html';
  if (normalized.startsWith('/')) return normalized.slice(1);
  return normalized;
}

export const previewProxyRouter = express.Router();

previewProxyRouter.use('/:projectName', (req, res) => {
  const projectName = req.params.projectName;
  const info = getPreviewProxyInfo(projectName);
  if (!info || !info.port) {
    return res.status(502).send('Preview server not running');
  }

  const encoded = encodeProjectSegment(projectName);
  const basePrefix = `/preview/${encoded}`;
  const forwardPath = extractForwardPath(basePrefix, req.originalUrl);

  proxyHttpRequest(info.port, forwardPath, req, res, projectName);
});

export const previewStaticRouter = express.Router();

previewStaticRouter.use('/:projectName', (req, res) => {
  const projectName = req.params.projectName;
  const info = getPreviewProxyInfo(projectName);
  if (!info || !info.staticRoot) {
    return res.status(404).send('Static preview not available');
  }
  const encoded = encodeProjectSegment(projectName);
  const basePrefix = `/preview-static/${encoded}`;
  const requestPath = extractForwardPath(basePrefix, req.originalUrl);
  const safeRelative = sanitizeStaticPath(requestPath);
  const absoluteRoot = path.resolve(info.staticRoot);
  const targetPath = path.resolve(absoluteRoot, safeRelative);

  if (!targetPath.startsWith(absoluteRoot)) {
    return res.status(400).send('Invalid preview path');
  }

  fs.stat(targetPath, (err, stats) => {
    let finalPath = targetPath;
    if (!err && stats.isDirectory()) {
      finalPath = path.join(targetPath, 'index.html');
    }

    const stream = fs.createReadStream(finalPath);
    stream.on('error', () => {
      res.status(404).send('Preview file not found');
    });
    stream.pipe(res);
  });
});

export const previewNextAssetRouter = express.Router();

previewNextAssetRouter.use((req, res) => {
  const projectName = extractProjectFromRequest(req);
  if (!projectName) return res.status(400).send('Missing preview project context');
  const info = getPreviewProxyInfo(projectName);
  if (!info?.port) return res.status(502).send('Preview server not running');
  proxyHttpRequest(info.port, req.originalUrl, req, res);
});

function proxyWebSocketUpgrade(port, req, socket, head) {
  const requestHeaders = {
    ...req.headers,
    host: `localhost:${port}`
  };
  const options = {
    hostname: '127.0.0.1',
    port,
    path: req.url,
    headers: requestHeaders,
    method: 'GET'
  };

  const proxyReq = http.request(options);
  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );

    proxySocket.write(proxyHead);
    if (head && head.length) {
      proxySocket.write(head);
    }
    socket.pipe(proxySocket).pipe(socket);
  });
  proxyReq.on('error', () => {
    socket.destroy();
  });
  proxyReq.end();
}

export function attachPreviewUpgradeHandler(server) {
  const existingListeners = server.listeners('upgrade');
  server.removeAllListeners('upgrade');

  server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/_next')) {
      const projectName = extractProjectFromRequest(req);
      if (!projectName) {
        socket.destroy();
        return;
      }
      const info = getPreviewProxyInfo(projectName);
      if (!info?.port) {
        socket.destroy();
        return;
      }
      proxyWebSocketUpgrade(info.port, req, socket, head);
      return;
    }

    for (const listener of existingListeners) {
      listener.call(server, req, socket, head);
    }
  });
}
