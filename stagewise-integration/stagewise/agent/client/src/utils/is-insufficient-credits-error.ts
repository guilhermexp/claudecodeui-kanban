import { isCustomTRPCError, isTRPCClientError } from '@stagewise/api-client';

export function isInsufficientCreditsError(error: unknown): boolean {
  if (isTRPCClientError(error) && isCustomTRPCError(error))
    return error.data.customError?.code === 'INSUFFICIENT_CREDITS';

  return false;
}
