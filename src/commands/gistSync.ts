import * as vscode from 'vscode';
import { GlobalStorage } from '../storage/globalStorage';
import { GitHubService } from '../services/githubService';

const GIST_FILE_NAME = 'ai-libraries-backup.json';

export class GistSync {
  public static async backup(storage: GlobalStorage): Promise<void> {
    const config = vscode.workspace.getConfiguration('aiLibs');
    const token = config.get<string>('githubToken');
    let gistId = config.get<string>('gistId');

    if (!token) {
      vscode.window.showErrorMessage('Backup falhou: Token do GitHub não configurado.');
      return;
    }

    const content = storage.getRawContent();

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fazendo backup das bibliotecas de IA no GitHub Gist...',
        cancellable: false
      }, async () => {
        const files = {
          [GIST_FILE_NAME]: { content }
        };

        if (gistId) {
          // Update existing gist
          await GitHubService.updateGist(token, gistId, files);
          vscode.window.showInformationMessage('Backup concluído com sucesso!');
        } else {
          // Create new gist
          const gist = await GitHubService.createGist(token, 'Backup do AI Library Manager', files);
          await config.update('gistId', gist.id, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Novo Gist criado e backup salvo! Gist ID: ${gist.id}`);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Falha no backup: ${(error as Error).message}`);
    }
  }

  public static async restore(storage: GlobalStorage): Promise<void> {
    const config = vscode.workspace.getConfiguration('aiLibs');
    const token = config.get<string>('githubToken');
    const gistId = config.get<string>('gistId');

    if (!token) {
      vscode.window.showErrorMessage('Restore falhou: Token do GitHub não configurado.');
      return;
    }

    if (!gistId) {
      vscode.window.showErrorMessage('Restore falhou: ID do Gist não configurado.');
      return;
    }

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Restaurando bibliotecas de IA do GitHub Gist...',
        cancellable: false
      }, async () => {
        const gist = await GitHubService.getGist(token, gistId);
        const backupFile = gist.files[GIST_FILE_NAME];

        if (backupFile && backupFile.content) {
          storage.restoreRawContent(backupFile.content);
          vscode.window.showInformationMessage('Configurações de bibliotecas restauradas com sucesso!');
        } else {
          vscode.window.showErrorMessage(`Arquivo de backup "${GIST_FILE_NAME}" não encontrado no Gist.`);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Falha no restore: ${(error as Error).message}`);
    }
  }
}
