import * as vscode from 'vscode';
import { ProjectStorage } from '../storage/projectStorage';
import { NpmService } from '../services/npmService';
import { GitHubService } from '../services/githubService';
import { Library } from '../storage/types';

export class Installer {
  public static async install(library: Library, scope: 'local' | 'global', customCommandKey: string = 'init'): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('Nenhum workspace aberto. Abra uma pasta para poder realizar a instalação.');
      return;
    }

    const command = customCommandKey === 'global' 
      ? (library.commands.global || `npm install -g ${library.npmPackage || library.id}`)
      : (library.commands[customCommandKey] || library.commands.init);

    if (!command) {
      vscode.window.showErrorMessage(`Comando "${customCommandKey}" não configurado para esta biblioteca.`);
      return;
    }

    // Run command in VS Code integrated terminal
    let terminal = vscode.window.terminals.find(t => t.name === 'AI Library Installer');
    if (!terminal) {
      terminal = vscode.window.createTerminal('AI Library Installer');
    }
    terminal.show();
    terminal.sendText(command);

    // Fetch the version to store in metadata
    let installedVersion = library.currentVersion || 'unknown';
    try {
      if (library.npmPackage) {
        installedVersion = await NpmService.getLatestVersion(library.npmPackage);
      } else if (library.github) {
        installedVersion = await GitHubService.getLatestVersion(library.github);
      }
    } catch {
      // ignore, fall back to currentVersion
    }

    // Save in project metadata
    ProjectStorage.addInstalledPackage({
      id: library.id,
      scope,
      installedVersion
    });

    vscode.window.showInformationMessage(`Comando de instalação enviado ao terminal e registrado no .ai-libs.json como "${scope}".`);
  }
}
