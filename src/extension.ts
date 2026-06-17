import * as vscode from 'vscode';
import { GlobalStorage } from './storage/globalStorage';
import { SidebarProvider } from './webview/sidebarProvider';
import { GistSync } from './commands/gistSync';
import { UpdateChecker } from './services/updateChecker';
import { SearchPanel } from './webview/searchPanel';

import { logDebug } from './services/http';

export function activate(context: vscode.ExtensionContext) {
  logDebug('Extension: activate function called');
  console.log('AI Library Manager extension activated.');

  // Initialize global storage
  const globalStorage = new GlobalStorage(context);

  // Initialize and register Sidebar Webview Provider
  const sidebarProvider = new SidebarProvider(context.extensionUri, globalStorage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
  );

  // Register commands for command palette
  context.subscriptions.push(
    vscode.commands.registerCommand('aiLibs.backupToGist', () => GistSync.backup(globalStorage)),
    vscode.commands.registerCommand('aiLibs.restoreFromGist', async () => {
      await GistSync.restore(globalStorage);
      sidebarProvider.sendLibrariesData();
    }),
    vscode.commands.registerCommand('aiLibs.checkUpdates', async () => {
      const updates = await UpdateChecker.checkProjectUpdates(globalStorage);
      // Let sidebar know if it's active
      sidebarProvider.sendLibrariesData();
      return updates;
    }),
    vscode.commands.registerCommand('aiLibs.openSearch', (query?: string, showPackageDetailsName?: string) => {
      SearchPanel.createOrShow(context.extensionUri, globalStorage, query || '', showPackageDetailsName);
    }),
    vscode.commands.registerCommand('aiLibs.refresh', () => {
      sidebarProvider.sendLibrariesData();
    })
  );

  // Trigger update check on activation if a workspace folder is open
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Run update checker with a slight delay so editor is fully loaded
    setTimeout(() => {
      UpdateChecker.checkProjectUpdates(globalStorage).catch(err => {
        console.error('Error during auto-update check:', err);
      });
    }, 3000);
  }

  // Trigger update check when workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      UpdateChecker.checkProjectUpdates(globalStorage).catch(err => {
        console.error('Error during workspace folder change update check:', err);
      });
    })
  );
}

export function deactivate() {}
