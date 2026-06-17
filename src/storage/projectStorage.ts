import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, ProjectPackage } from './types';

export class ProjectStorage {
  private static getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return undefined;
  }

  private static getConfigPath(): string | undefined {
    const root = this.getWorkspaceRoot();
    if (!root) { return undefined; }
    return path.join(root, '.ai-libs.json');
  }

  public static getProjectConfig(): ProjectConfig {
    const configPath = this.getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
      return { installedPackages: [] };
    }
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content) as ProjectConfig;
    } catch (error) {
      console.error('Error reading project config:', error);
      return { installedPackages: [] };
    }
  }

  public static saveProjectConfig(config: ProjectConfig): void {
    const configPath = this.getConfigPath();
    if (!configPath) { return; }
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      console.error('Error writing project config:', error);
    }
  }

  public static addInstalledPackage(pkg: Omit<ProjectPackage, 'installedAt'>): void {
    const config = this.getProjectConfig();
    const index = config.installedPackages.findIndex(p => p.id === pkg.id);
    const updatedPkg: ProjectPackage = {
      ...pkg,
      installedAt: new Date().toISOString()
    };
    if (index >= 0) {
      config.installedPackages[index] = updatedPkg;
    } else {
      config.installedPackages.push(updatedPkg);
    }
    this.saveProjectConfig(config);
  }

  public static removeInstalledPackage(id: string): void {
    const config = this.getProjectConfig();
    config.installedPackages = config.installedPackages.filter(p => p.id !== id);
    this.saveProjectConfig(config);
  }
}
