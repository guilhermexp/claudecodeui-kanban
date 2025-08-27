import {
  defineDocs,
  defineConfig,
  defineCollections,
  frontmatterSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';

// Options: https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: 'content/docs',
});

export const newsPosts = defineCollections({
  type: 'doc',
  dir: 'content/news',
  // add required frontmatter properties
  schema: frontmatterSchema.extend({
    author: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.string().date().or(z.date()),
    ogImage: z.string().url().optional(),
  }),
});

export const legalTexts = defineDocs({
  dir: 'content/legal',
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});
