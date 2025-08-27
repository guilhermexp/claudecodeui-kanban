import * as vscode from 'vscode';

/**
 * Checks if the Cline extension is installed.
 * @returns True if the extension is installed, false otherwise.
 */
export function isClineInstalled(): boolean {
  const extensionId = 'saoudrizwan.claude-dev';
  const extension = vscode.extensions.getExtension(extensionId);
  return !!extension;
}
