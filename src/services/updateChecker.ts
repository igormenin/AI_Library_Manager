import * as vscode from 'vscode';
import { ProjectStorage } from '../storage/projectStorage';
import { GlobalStorage } from '../storage/globalStorage';
import { NpmService } from './npmService';
import { GitHubService } from './githubService';

export interface UpdateInfo {
  id: string;
  name: string;
  installedVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export class UpdateChecker {
  public static async checkProjectUpdates(globalStorage: GlobalStorage): Promise<UpdateInfo[]> {
    const projectConfig = ProjectStorage.getProjectConfig();
    const globalLibs = globalStorage.getLibraries();
    const updates: UpdateInfo[] = [];

    for (const pkg of projectConfig.installedPackages) {
      const lib = globalLibs.find(l => l.id === pkg.id);
      if (!lib) { continue; }

      let latestVersion = pkg.installedVersion;
      try {
        if (lib.npmPackage) {
          latestVersion = await NpmService.getLatestVersion(lib.npmPackage);
        } else if (lib.github) {
          latestVersion = await GitHubService.getLatestVersion(lib.github);
        }
      } catch (err) {
        console.error(`Failed to check updates for ${pkg.id}:`, err);
      }

      const hasUpdate = this.isNewerVersion(pkg.installedVersion, latestVersion);
      updates.push({
        id: pkg.id,
        name: lib.name,
        installedVersion: pkg.installedVersion,
        latestVersion,
        hasUpdate
      });
    }

    // Trigger VS Code notification for updates
    const availableUpdates = updates.filter(u => u.hasUpdate);
    if (availableUpdates.length > 0) {
      const names = availableUpdates.map(u => u.name).join(', ');
      vscode.window.showInformationMessage(
        `Atualizações disponíveis para as bibliotecas de IA: ${names}. Abra a aba lateral para atualizá-las.`,
        'Ver Painel'
      ).then(selection => {
        if (selection === 'Ver Painel') {
          vscode.commands.executeCommand('workbench.view.extension.ai-library-manager-sidebar');
        }
      });
    }

    return updates;
  }

  private static isNewerVersion(current: string, latest: string): boolean {
    if (current === 'unknown' || !current) { return false; }
    // Simple semantic version comparator
    const clean = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const currParts = clean(current);
    const lateParts = clean(latest);

    for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
      const currPart = currParts[i] || 0;
      const latePart = lateParts[i] || 0;
      if (latePart > currPart) { return true; }
      if (currPart > latePart) { return false; }
    }
    return false;
  }
}
