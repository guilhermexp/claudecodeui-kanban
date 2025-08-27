import { z } from 'zod';

/**
 * Represents a snippet that will be formatted into a prompt section.
 *
 * The snippet will be formatted into the following structure:
 * ```
 * <{{type}}>
 *    <description>
 *        {{description}}
 *    </description>
 *    <content>
 *        {{content}}
 *    </content>
 * </{{type}}>
 * ```
 *
 * @property {string} type - The type identifier that will be used in the opening and closing tags
 * @property {string} description - The description text that will be placed in the description section
 * @property {string} content - The main content that will be placed in the content section
 */
export const promptSnippetSchema = z.object({
  type: z.string(),
  description: z.string(),
  content: z.string(),
});

export type PromptSnippet = z.infer<typeof promptSnippetSchema>;
