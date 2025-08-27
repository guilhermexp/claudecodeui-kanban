import type { cliTools } from '@stagewise/agent-tools';
import { z } from 'zod';

type Tools = ReturnType<typeof cliTools>;

/**
 * Maps Zod schema tools to JSON schema format for the API
 */
export function mapZodToolsToJsonSchemaTools(
  tools: Tools,
): Record<string, { description: string; inputSchema: any }> {
  return Object.entries(tools).reduce(
    (acc, [key, value]) => {
      acc[key] = {
        description: value.description ?? `Tool: ${key}`,
        inputSchema: z.toJSONSchema(value.inputSchema as z.ZodType),
      };
      return acc;
    },
    {} as Record<
      string,
      { description: string; inputSchema: z.core.JSONSchema.BaseSchema }
    >,
  );
}
