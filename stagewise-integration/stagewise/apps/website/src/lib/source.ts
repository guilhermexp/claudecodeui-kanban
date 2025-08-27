import { docs, newsPosts, legalTexts } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export const news = loader({
  baseUrl: '/news',
  source: createMDXSource(newsPosts),
  slugs: (info) => [info.name.split('-').slice(1).join('-')],
});

export const legal = loader({
  baseUrl: '/legal',
  source: legalTexts.toFumadocsSource(),
});
