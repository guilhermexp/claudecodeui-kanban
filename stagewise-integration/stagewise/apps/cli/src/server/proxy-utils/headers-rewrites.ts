import type { IncomingMessage } from 'node:http';

export const applyHeaderRewrites = async (proxyRes: IncomingMessage) => {
  // We patch x-frame-options to allow loading the website in an iframe
  if (
    proxyRes.headers['x-frame-options'] === 'DENY' ||
    proxyRes.headers['x-frame-options'] === 'DENY-FROM-ALL'
  ) {
    proxyRes.headers['x-frame-options'] = 'SAMEORIGIN';
  }

  // We check CSP allowed frame-ancestors
  if (
    'content-security-policy' in proxyRes.headers &&
    proxyRes.headers['content-security-policy']!.includes('frame-ancestors')
  ) {
    const csp = disassembleCSP(
      proxyRes.headers['content-security-policy'] as string,
    );
    if (
      csp.directives['frame-ancestors'] &&
      csp.directives['frame-ancestors'].length > 0
    ) {
      if (csp.directives['frame-ancestors'].includes('none')) {
        csp.directives['frame-ancestors'] = csp.directives[
          'frame-ancestors'
        ]!.filter((value) => value !== 'none');
      }
      if (
        !csp.directives['frame-ancestors'].includes("'self'") &&
        csp.directives['frame-ancestors'].length > 0
      ) {
        csp.directives['frame-ancestors'].push("'self'");
      }
      proxyRes.headers['content-security-policy'] = assembleCSP(csp);
    }
  }
};

type CSP = {
  directives: Record<string, string[]>;
};

const disassembleCSP = (csp: string): CSP => {
  const directives: Record<string, string[]> = {};
  const lines = csp.split(';');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 1) {
      directives[parts[0]!] = parts.slice(1);
    }
  }
  return { directives };
};

const assembleCSP = (csp: CSP): string => {
  return Object.entries(csp.directives)
    .filter(([_, values]) => values.length > 0)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
};
