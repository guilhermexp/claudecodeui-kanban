import { describe, it, expect } from 'vitest';
import { errorPage } from '../../../src/server/error-page';

describe('error-page', () => {
  it('should generate HTML error page with correct port', () => {
    const html = errorPage(3000);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('port 3000');
    expect(html).toContain('Dev App not reachable');
  });

  it('should include proper meta tags', () => {
    const html = errorPage(3000);

    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
  });

  it('should include styling', () => {
    const html = errorPage(3000);

    expect(html).toContain('<style>');
    expect(html).toContain("font-family: 'Inter'");
  });

  it('should display different ports correctly', () => {
    const html1 = errorPage(8080);
    const html2 = errorPage(4200);

    expect(html1).toContain('port 8080');
    expect(html2).toContain('port 4200');
  });

  it('should include instructions for the user', () => {
    const html = errorPage(3000);

    expect(html).toContain('dev server of your project is running');
    expect(html).toContain('try again');
  });
});
