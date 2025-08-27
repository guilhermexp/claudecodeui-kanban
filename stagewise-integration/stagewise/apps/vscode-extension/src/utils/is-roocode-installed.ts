import * as vscode from 'vscode';

/**
 * Checks if the Roo-code extension is installed.
 * @returns True if the extension is installed, false otherwise.
 */
export function isRoocodeInstalled(): boolean {
  const extensionId = 'RooVeterinaryInc.roo-cline';
  const extension = vscode.extensions.getExtension(extensionId);
  return !!extension;
}
