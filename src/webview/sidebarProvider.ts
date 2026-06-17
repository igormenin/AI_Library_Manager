import * as vscode from 'vscode';
import { GlobalStorage } from '../storage/globalStorage';
import { ProjectStorage } from '../storage/projectStorage';
import { Installer } from '../commands/installer';
import { UpdateChecker } from '../services/updateChecker';
import { GistSync } from '../commands/gistSync';
import { NpmService } from '../services/npmService';
import { GitHubService } from '../services/githubService';
import { Library } from '../storage/types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ai-library-manager-sidebar-view';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _globalStorage: GlobalStorage
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getLibraries': {
          this.sendLibrariesData();
          break;
        }
        case 'install': {
          const lib = data.library as Library;
          await Installer.install(lib, data.scope, data.commandKey);
          this.sendLibrariesData();
          break;
        }
        case 'checkUpdates': {
          vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Verificando atualizações...',
            cancellable: false
          }, async () => {
            const updates = await UpdateChecker.checkProjectUpdates(this._globalStorage);
            this.sendLibrariesData();
            webviewView.webview.postMessage({ type: 'updateStatus', updates });
          });
          break;
        }
        case 'addLibrary': {
          const newLib = data.library as Library;
          this._globalStorage.addLibrary(newLib);
          this.sendLibrariesData();
          vscode.window.showInformationMessage(`Biblioteca "${newLib.name}" adicionada/atualizada com sucesso!`);
          break;
        }
        case 'deleteLibrary': {
          this._globalStorage.removeLibrary(data.id);
          this.sendLibrariesData();
          vscode.window.showInformationMessage('Biblioteca removida com sucesso.');
          break;
        }
        case 'backup': {
          const config = vscode.workspace.getConfiguration('aiLibs');
          const token = config.get<string>('githubToken');
          
          if (!token) {
            webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'backup', error: 'Token não configurado.' });
            break;
          }
          
          const isValid = await GitHubService.validateToken(token);
          if (!isValid) {
            webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'backup', error: 'Token configurado é inválido ou sem permissão para Gists.' });
            break;
          }

          await GistSync.backup(this._globalStorage);
          this.sendLibrariesData();
          break;
        }
        case 'restore': {
          const config = vscode.workspace.getConfiguration('aiLibs');
          const token = config.get<string>('githubToken');
          const gistId = config.get<string>('gistId');

          if (!token) {
            webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'restore', error: 'Token não configurado.' });
            break;
          }

          const isValid = await GitHubService.validateToken(token);
          if (!isValid) {
            webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'restore', error: 'Token configurado é inválido ou sem permissão para Gists.' });
            break;
          }

          if (!gistId) {
            webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'restore', error: 'ID do Gist é necessário para restaurar.' });
            break;
          }

          await GistSync.restore(this._globalStorage);
          this.sendLibrariesData();
          break;
        }
        case 'saveGistConfig': {
          const { token, gistId, action } = data;
          const config = vscode.workspace.getConfiguration('aiLibs');
          
          // Test the token
          const isValid = await GitHubService.validateToken(token);
          if (!isValid) {
            webviewView.webview.postMessage({
              type: 'gistConfigRequired',
              action,
              error: 'O token fornecido é inválido ou não possui permissão (escopo "gist") no GitHub.'
            });
            break;
          }

          // Save globally in VS Code config
          await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
          await config.update('gistId', gistId || '', vscode.ConfigurationTarget.Global);
          
          webviewView.webview.postMessage({ type: 'gistConfigSuccess' });
          vscode.window.showInformationMessage('Credenciais do GitHub salvas com sucesso!');

          // Execute action
          if (action === 'backup') {
            await GistSync.backup(this._globalStorage);
          } else if (action === 'restore') {
            if (!gistId) {
              webviewView.webview.postMessage({ type: 'gistConfigRequired', action: 'restore', error: 'ID do Gist é obrigatório para restaurar.' });
              break;
            }
            await GistSync.restore(this._globalStorage);
          }
          this.sendLibrariesData();
          break;
        }
        case 'openSearch': {
          vscode.commands.executeCommand('aiLibs.openSearch', data.query || '');
          break;
        }
        case 'openPackageDetailsInApp': {
          vscode.commands.executeCommand('aiLibs.openSearch', '', data.packageName);
          break;
        }
      }
    });

    // Send initial data
    this.sendLibrariesData();
  }

  public sendLibrariesData() {
    if (!this._view) { return; }
    const libs = this._globalStorage.getLibraries();
    const projectConfig = ProjectStorage.getProjectConfig();
    const config = vscode.workspace.getConfiguration('aiLibs');

    this._view.webview.postMessage({
      type: 'loadLibraries',
      libraries: libs,
      projectPackages: projectConfig.installedPackages,
      gistSettings: {
        token: config.get<string>('githubToken') || '',
        gistId: config.get<string>('gistId') || ''
      }
    });

    if (UpdateChecker.lastCheckedUpdates.length > 0) {
      this._view.webview.postMessage({
        type: 'updateStatus',
        updates: UpdateChecker.lastCheckedUpdates
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.WebviewView['webview']) {
    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Library Manager</title>
  <style>
    :root {
      --primary-gradient: linear-gradient(135deg, #4f46e5, #06b6d4);
      --card-bg: var(--vscode-sideBar-background, #1e1e2e);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-color: var(--vscode-sideBar-foreground, #cdd6f4);
      --text-muted: #a6adc8;
      --accent-color: #06b6d4;
      --bg-dark: rgba(0, 0, 0, 0.2);
    }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: var(--vscode-sideBar-background);
      color: var(--text-color);
      margin: 0;
      padding: 12px;
      font-size: 13px;
      line-height: 1.5;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin: 16px 0 8px 0;
      font-weight: bold;
    }

    /* Action bar */
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }

    button {
      background: var(--vscode-button-background, #4f46e5);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    button.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-color);
      border: 1px solid var(--card-border);
    }

    button.secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    /* Library Cards */
    .lib-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .lib-card {
      background: var(--bg-dark);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .lib-card:hover {
      border-color: var(--accent-color);
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.1);
    }

    .lib-card.installed {
      border-color: var(--vscode-charts-green, #22c55e);
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.08);
    }

    .lib-card.installed:hover {
      border-color: #4ade80;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);
    }

    .lib-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .lib-name {
      font-weight: 600;
      font-size: 14px;
      color: #ffffff;
    }

    .lib-version {
      font-size: 10px;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 10px;
      color: var(--text-muted);
    }

    .lib-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      margin-bottom: 8px;
    }

    .lib-meta-buttons {
      display: flex;
      gap: 6px;
    }

    .lib-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .lib-details {
      display: none;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    
    .lib-details.show {
      display: block;
    }

    .lib-details-row {
      margin-bottom: 6px;
      word-break: break-all;
    }

    .lib-details-row strong {
      color: #ffffff;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-weight: bold;
    }

    .status-badge.installed {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
    }

    .status-badge.update {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    .lib-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .lib-actions button {
      padding: 4px 8px;
      font-size: 11px;
    }

    /* Modal Form */
    .form-container {
      background: var(--bg-dark);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      display: none;
    }

    .form-group {
      margin-bottom: 8px;
    }

    .form-group label {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .form-group input, .form-group textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--card-border);
      border-radius: 4px;
      color: #ffffff;
      padding: 6px;
      font-size: 12px;
    }

    .form-group input:focus, .form-group textarea:focus {
      border-color: var(--accent-color);
      outline: none;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 10px;
    }

    .danger-btn {
      background: #ef4444 !important;
    }
    
    .danger-btn:hover {
      background: #dc2626 !important;
    }

    .warning-btn {
      background: var(--vscode-notificationsWarningIcon-foreground, #f59e0b) !important;
      color: #ffffff !important;
    }
    
    .warning-btn:hover {
      background: #fbbf24 !important;
      opacity: 1 !important;
    }

    .search-box {
      margin-bottom: 16px;
      background: var(--bg-dark);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px;
    }

    .search-title {
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 12px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .search-results {
      display: none;
      margin-top: 10px;
      max-height: 180px;
      overflow-y: auto;
      border-top: 1px solid var(--card-border);
      padding-top: 8px;
      flex-direction: column;
      gap: 8px;
    }

    .search-result-item {
      padding: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  </style>
</head>
<body>
  <h3>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
      <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
      <path d="M12 2v4M12 6H8m4 0h4"></path>
      <circle cx="8" cy="15" r="1"></circle>
      <circle cx="16" cy="15" r="1"></circle>
    </svg>
    AI Library Manager
  </h3>

  <div class="actions-grid">
    <button onclick="toggleForm()">+ Nova Lib</button>
    <button class="secondary" onclick="checkUpdates()">Checar Atualizações</button>
    <button class="secondary" onclick="backupGist()">Backup Gist</button>
    <button class="secondary" onclick="restoreGist()">Restore Gist</button>
  </div>

  <!-- Barra de Busca NPM -->
  <button class="search-box" onclick="openSearchTab()" style="width: 100%; margin-bottom: 16px; background: var(--primary-gradient); color: #ffffff; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    Buscar novos pacotes (NPM)
  </button>

  <!-- Formulário de Configuração do Gist (Verificação e Instruções) -->
  <div id="gistForm" class="form-container" style="border-color: #f59e0b; background: rgba(245, 158, 11, 0.04);">
    <div style="font-weight:600; margin-bottom:10px; color: #f59e0b; display:flex; align-items:center; gap:6px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      Configuração do GitHub Gist
    </div>
    <div id="gistErrorMsg" style="color: #f87171; font-size: 11px; margin-bottom: 10px; font-weight: 500;"></div>
    
    <div style="font-size: 11px; line-height: 1.45; color: var(--text-muted); margin-bottom: 12px; background: rgba(0, 0, 0, 0.3); padding: 8px; border-radius: 6px; border: 1px solid var(--card-border);">
      <strong style="color: #ffffff; display: block; margin-bottom: 4px;">Como obter seu Token (PAT):</strong>
      <span style="color: #f59e0b; font-weight: 600; display: block; margin-bottom: 6px;">⚠️ IMPORTANTE: Selecione "Tokens (classic)" no menu lateral esquerdo do GitHub. Os tokens "Fine-grained" NÃO suportam Gists!</span>
      1. Acesse o GitHub em <a href="https://github.com/settings/tokens/new?scopes=gist&description=AI%20Library%20Manager" target="_blank" style="color: #06b6d4; text-decoration: underline; font-weight: 600;">Gerador de Token Clássico</a>.<br>
      2. No campo <strong>Note</strong>, defina um identificador.<br>
      3. Certifique-se de manter o escopo <strong style="color: #ffffff;">gist</strong> marcado.<br>
      4. Clique em <strong>Generate Token</strong> no final da página.<br>
      5. Copie o token gerado (começa com <code>ghp_</code>) e cole abaixo.
    </div>

    <input type="hidden" id="gistPendingAction">
    <div class="form-group">
      <label>GitHub Personal Access Token (PAT)</label>
      <input type="password" id="gistToken" placeholder="ghp_...">
    </div>
    <div class="form-group" id="gistIdGroup">
      <label>ID do Gist (Obrigatório para Restore)</label>
      <input type="text" id="gistIdInput" placeholder="Ex: 8f72aeffa1...">
    </div>
    <div class="form-actions">
      <button class="secondary" onclick="toggleGistForm(false)">Cancelar</button>
      <button onclick="saveAndVerifyGist()" style="background: #f59e0b; color: #ffffff; font-weight: 600;">Verificar e Salvar</button>
    </div>
  </div>

  <!-- Formulário de Adicionar/Editar -->
  <div id="libForm" class="form-container">
    <div class="form-title" id="formTitle" style="font-weight:600; margin-bottom:10px;">Adicionar Biblioteca</div>
    <input type="hidden" id="libId">
    <div class="form-group">
      <label>Nome da Biblioteca</label>
      <input type="text" id="libName" placeholder="Ex: Antigravity Git">
    </div>
    <div class="form-group">
      <label>Descrição</label>
      <textarea id="libDesc" rows="2" placeholder="O que esta biblioteca faz..."></textarea>
    </div>
    <div class="form-group">
      <label>Pacote NPM (opcional)</label>
      <input type="text" id="libNpm" placeholder="Ex: @vudovn/ag-kit">
    </div>
    <div class="form-group">
      <label>Repositório GitHub (opcional)</label>
      <input type="text" id="libGithub" placeholder="Ex: vudovn/ag-kit">
    </div>
    <div class="form-group">
      <label>Comando Init/Instalar</label>
      <input type="text" id="libCmdInit" placeholder="Ex: npx @vudovn/ag-kit init">
    </div>
    <div class="form-group">
      <label>Comando Instalação Global (opcional)</label>
      <input type="text" id="libCmdGlobal" placeholder="Ex: npm install -g @vudovn/ag-kit">
    </div>
    <div class="form-actions">
      <button class="secondary" onclick="toggleForm(false)">Cancelar</button>
      <button onclick="saveLibrary()">Salvar</button>
    </div>
  </div>

  <div class="section-title">Bibliotecas Cadastradas</div>
  <div class="lib-list" id="librariesContainer">
    <!-- Renderizado dinamicamente -->
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentLibraries = [];
    let projectPackages = [];
    let updateStatus = {};
    const expandedLibs = new Set();

    function toggleDetails(id) {
      const details = document.getElementById('details-' + id);
      if (details.classList.contains('show')) {
        details.classList.remove('show');
        expandedLibs.delete(id);
      } else {
        details.classList.add('show');
        expandedLibs.add(id);
      }
    }

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'loadLibraries':
          currentLibraries = message.libraries || [];
          projectPackages = message.projectPackages || [];
          if (message.gistSettings) {
            document.getElementById('gistToken').value = message.gistSettings.token || '';
            document.getElementById('gistIdInput').value = message.gistSettings.gistId || '';
          }
          renderLibraries();
          break;
        case 'updateStatus':
          const updates = message.updates || [];
          updateStatus = {};
          updates.forEach(u => {
            updateStatus[u.id] = u;
          });
          renderLibraries();
          break;
        // search results handled in the central search panel
        case 'gistConfigRequired':
          showGistConfig(message.action, message.error);
          break;
        case 'gistConfigSuccess':
          toggleGistForm(false);
          break;
      }
    });

    function renderLibraries() {
      const container = document.getElementById('librariesContainer');
      container.innerHTML = '';

      if (currentLibraries.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">Nenhuma biblioteca cadastrada.</div>';
        return;
      }

      // Sort libraries so that installed ones are rendered first
      const sortedLibraries = [...currentLibraries].sort((a, b) => {
        const aInstalled = projectPackages.some(p => p.id === a.id) ? 1 : 0;
        const bInstalled = projectPackages.some(p => p.id === b.id) ? 1 : 0;
        return bInstalled - aInstalled;
      });

      sortedLibraries.forEach(lib => {
        const installedPkg = projectPackages.find(p => p.id === lib.id);
        const update = updateStatus[lib.id];
        const isExpanded = expandedLibs.has(lib.id);
        const detailsClass = isExpanded ? 'lib-details show' : 'lib-details';

        const card = document.createElement('div');
        card.className = installedPkg ? 'lib-card installed' : 'lib-card';

        let badgesHtml = '';
        let updateIconHtml = '';
        if (installedPkg) {
          if (update && update.hasUpdate) {
            badgesHtml += \`<span class="status-badge update">Upgrade: \${installedPkg.installedVersion} ➔ \${update.latestVersion}</span>\`;
            updateIconHtml = \`
              <span class="update-pulse-icon" title="Atualização disponível!" style="margin-left: 6px; display: inline-flex; align-items: center; vertical-align: middle; color: #facc15; animation: pulse 2s infinite;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="16 12 12 8 8 12"></polyline>
                  <line x1="12" y1="16" x2="12" y2="8"></line>
                </svg>
              </span>
            \`;
          } else {
            badgesHtml += \`<span class="status-badge installed">Instalado (\${installedPkg.scope}: \${installedPkg.installedVersion})</span>\`;
          }
        }

        let localBtnText = 'Instalar Local';
        let localBtnClass = '';
        let globalBtnText = 'Instalar Global';
        let globalBtnClass = 'secondary';

        if (update && update.hasUpdate) {
          localBtnText = 'Atualizar Local';
          localBtnClass = 'warning-btn';
          globalBtnText = 'Atualizar Global';
          globalBtnClass = 'secondary warning-btn';
        }

        card.innerHTML = \`
          <div class="lib-header" style="cursor: pointer;" onclick="toggleDetails('\${lib.id}')">
            <span class="lib-name" style="\${lib.npmPackage ? 'text-decoration: underline; color: var(--accent-color);' : ''}" onclick="\${lib.npmPackage ? \`openPackageDetailsInApp('\${escapeHtml(lib.npmPackage)}'); event.stopPropagation();\` : ''}">\${escapeHtml(lib.name)}\${updateIconHtml}</span>
          </div>
          <div class="lib-meta-row">
            <div class="lib-meta-buttons">
              <button class="secondary" style="padding: 2px 6px; font-size: 10px; height: auto;" onclick="editLibrary('\${lib.id}'); event.stopPropagation();">Editar</button>
              <button class="secondary danger-btn" style="padding: 2px 6px; font-size: 10px; height: auto;" onclick="deleteLibrary('\${lib.id}'); event.stopPropagation();">Excluir</button>
            </div>
            <span class="lib-version">v\${lib.currentVersion || '1.0.0'}</span>
          </div>
          <div class="lib-desc" style="cursor: pointer;" onclick="toggleDetails('\${lib.id}')">\${escapeHtml(lib.description)}</div>
          \${badgesHtml}
          
          <div class="\${detailsClass}" id="details-\${lib.id}">
            \${lib.npmPackage ? \`<div class="lib-details-row"><strong>NPM:</strong> <a href="#" onclick="openPackageDetailsInApp('\${escapeHtml(lib.npmPackage)}'); return false;" style="color: var(--accent-color);">\${escapeHtml(lib.npmPackage)}</a></div>\` : ''}
            \${lib.github ? \`<div class="lib-details-row"><strong>GitHub:</strong> <a href="https://github.com/\${lib.github}" target="_blank" style="color: var(--accent-color);">\${escapeHtml(lib.github)}</a></div>\` : ''}
            <div class="lib-details-row"><strong>Cmd Local:</strong> <code>\${escapeHtml(lib.commands.init)}</code></div>
            \${lib.commands.global ? \`<div class="lib-details-row"><strong>Cmd Global:</strong> <code>\${escapeHtml(lib.commands.global)}</code></div>\` : ''}
            \${lib.lastChecked ? \`<div class="lib-details-row"><strong>Última checagem:</strong> \${new Date(lib.lastChecked).toLocaleString()}</div>\` : ''}
          </div>

          <div class="lib-actions" style="margin-top: 10px;">
            <button class="\${localBtnClass}" onclick="installLocal('\${lib.id}')">\${localBtnText}</button>
            \${lib.commands.global ? \`<button class="\${globalBtnClass}" onclick="installGlobal('\${lib.id}')">\${globalBtnText}</button>\` : ''}
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function openSearchTab() {
      vscode.postMessage({ type: 'openSearch', query: '' });
    }

    function openPackageDetailsInApp(packageName) {
      vscode.postMessage({ type: 'openPackageDetailsInApp', packageName });
    }

    function showGistConfig(action, error) {
      document.getElementById('gistPendingAction').value = action;
      document.getElementById('gistErrorMsg').innerText = error || '';
      
      const gistIdGroup = document.getElementById('gistIdGroup');
      if (action === 'restore') {
        gistIdGroup.style.display = 'block';
      } else {
        gistIdGroup.style.display = 'none';
      }
      
      toggleGistForm(true);
      document.getElementById('gistForm').scrollIntoView({ behavior: 'smooth' });
    }

    function toggleGistForm(show) {
      const form = document.getElementById('gistForm');
      const shouldShow = show !== undefined ? show : (form.style.display !== 'block');
      form.style.display = shouldShow ? 'block' : 'none';
      setMainUiVisible(!shouldShow);
      if (!shouldShow) {
        document.getElementById('gistPendingAction').value = '';
        document.getElementById('gistErrorMsg').innerText = '';
      }
    }

    function saveAndVerifyGist() {
      const token = document.getElementById('gistToken').value;
      const gistId = document.getElementById('gistIdInput').value;
      const action = document.getElementById('gistPendingAction').value;

      if (!token) {
        alert('Por favor insira o token ghp_...');
        return;
      }

      if (action === 'restore' && !gistId) {
        alert('Por favor insira o ID do Gist para poder realizar a restauração.');
        return;
      }

      document.getElementById('gistErrorMsg').innerText = 'Validando token com a API do GitHub...';

      vscode.postMessage({
        type: 'saveGistConfig',
        token,
        gistId,
        action
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function setMainUiVisible(visible) {
      const displayStyle = visible ? 'block' : 'none';
      const gridDisplay = visible ? 'grid' : 'none';
      
      const actionsGrid = document.querySelector('.actions-grid');
      const searchBox = document.querySelector('.search-box');
      const sectionTitle = document.querySelector('.section-title');
      const libContainer = document.getElementById('librariesContainer');
      
      if (actionsGrid) actionsGrid.style.display = gridDisplay;
      if (searchBox) searchBox.style.display = visible ? 'inline-flex' : 'none';
      if (sectionTitle) sectionTitle.style.display = displayStyle;
      if (libContainer) libContainer.style.display = displayStyle;
    }

    function toggleForm(show) {
      const form = document.getElementById('libForm');
      const shouldShow = show !== undefined ? show : (form.style.display !== 'block');
      form.style.display = shouldShow ? 'block' : 'none';
      setMainUiVisible(!shouldShow);
      if (!shouldShow) {
        // Clear fields
        document.getElementById('libId').value = '';
        document.getElementById('libName').value = '';
        document.getElementById('libDesc').value = '';
        document.getElementById('libNpm').value = '';
        document.getElementById('libGithub').value = '';
        document.getElementById('libCmdInit').value = '';
        document.getElementById('libCmdGlobal').value = '';
        document.getElementById('formTitle').innerText = 'Adicionar Biblioteca';
      }
    }

    function saveLibrary() {
      const name = document.getElementById('libName').value;
      const desc = document.getElementById('libDesc').value;
      const initCmd = document.getElementById('libCmdInit').value;

      if (!name || !desc || !initCmd) {
        alert('Por favor preencha os campos obrigatórios (Nome, Descrição e Comando Init).');
        return;
      }

      const id = document.getElementById('libId').value || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      const library = {
        id,
        name,
        description: desc,
        npmPackage: document.getElementById('libNpm').value || undefined,
        github: document.getElementById('libGithub').value || undefined,
        commands: {
          init: initCmd,
          global: document.getElementById('libCmdGlobal').value || undefined
        },
        currentVersion: '1.0.0'
      };

      vscode.postMessage({ type: 'addLibrary', library });
      toggleForm(false);
    }

    function editLibrary(id) {
      const lib = currentLibraries.find(l => l.id === id);
      if (!lib) return;

      document.getElementById('libId').value = lib.id;
      document.getElementById('libName').value = lib.name;
      document.getElementById('libDesc').value = lib.description;
      document.getElementById('libNpm').value = lib.npmPackage || '';
      document.getElementById('libGithub').value = lib.github || '';
      document.getElementById('libCmdInit').value = lib.commands.init || '';
      document.getElementById('libCmdGlobal').value = lib.commands.global || '';
      document.getElementById('formTitle').innerText = 'Editar Biblioteca';

      toggleForm(true);
    }

    function deleteLibrary(id) {
      if (confirm('Tem certeza de que deseja remover esta biblioteca?')) {
        vscode.postMessage({ type: 'deleteLibrary', id });
      }
    }

    function installLocal(id) {
      const lib = currentLibraries.find(l => l.id === id);
      if (lib) {
        vscode.postMessage({ type: 'install', library: lib, scope: 'local', commandKey: 'init' });
      }
    }

    function installGlobal(id) {
      const lib = currentLibraries.find(l => l.id === id);
      if (lib) {
        vscode.postMessage({ type: 'install', library: lib, scope: 'global', commandKey: 'global' });
      }
    }

    function checkUpdates() {
      vscode.postMessage({ type: 'checkUpdates' });
    }



    function backupGist() {
      vscode.postMessage({ type: 'backup' });
    }

    function restoreGist() {
      vscode.postMessage({ type: 'restore' });
    }

    // Request initial data once the webview script is fully loaded
    vscode.postMessage({ type: 'getLibraries' });
  </script>
</body>
</html>`;
  }
}
