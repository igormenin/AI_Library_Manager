import * as vscode from 'vscode';
import { GlobalStorage } from '../storage/globalStorage';
import { NpmService } from '../services/npmService';
import { Library } from '../storage/types';
import { logDebug } from '../services/http';

export class SearchPanel {
  public static currentPanel: SearchPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _globalStorage: GlobalStorage;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    globalStorage: GlobalStorage,
    initialQuery: string = '',
    showPackageDetailsName?: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SearchPanel.currentPanel) {
      SearchPanel.currentPanel._panel.reveal(column);
      if (showPackageDetailsName) {
        SearchPanel.currentPanel.sendPackageDetailsTrigger(showPackageDetailsName);
      } else if (initialQuery) {
        SearchPanel.currentPanel.sendInitialQuery(initialQuery);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'npmSearchPanel',
      'Buscar Bibliotecas de IA',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    SearchPanel.currentPanel = new SearchPanel(panel, extensionUri, globalStorage);
    
    if (showPackageDetailsName) {
      setTimeout(() => {
        if (SearchPanel.currentPanel) {
          SearchPanel.currentPanel.sendPackageDetailsTrigger(showPackageDetailsName);
        }
      }, 300);
    } else if (initialQuery) {
      SearchPanel.currentPanel.sendInitialQuery(initialQuery);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    globalStorage: GlobalStorage
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._globalStorage = globalStorage;

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'searchPackages': {
            logDebug(`Extension searchPanel: Received searchPackages message: ${JSON.stringify(message)}`);
            try {
              const results = await NpmService.searchPackages(
                message.query,
                message.page,
                message.sortBy,
                message.pageSize
              );
              logDebug(`Extension searchPanel: Sending ${results.length} search results back to webview`);
              this._panel.webview.postMessage({ type: 'searchResults', results });
            } catch (err) {
              logDebug(`Extension searchPanel: Search error: ${(err as Error).message}`);
              vscode.window.showErrorMessage(`Erro ao buscar pacotes: ${(err as Error).message}`);
              this._panel.webview.postMessage({ type: 'searchResults', results: [] });
            }
            break;
          }
          case 'addLibrary': {
            const newLib = message.library as Library;
            this._globalStorage.addLibrary(newLib);
            vscode.commands.executeCommand('aiLibs.refresh');
            vscode.window.showInformationMessage(`Biblioteca "${newLib.name}" adicionada com sucesso!`);
            break;
          }
          case 'getPackageDetails': {
            logDebug(`Extension searchPanel: Received getPackageDetails for: ${message.packageName}`);
            try {
              const info = await NpmService.getPackageInfo(message.packageName);
              logDebug(`Extension searchPanel: Sending package details for: ${message.packageName}`);
              this._panel.webview.postMessage({
                type: 'packageDetails',
                packageName: message.packageName,
                readme: info.readme || 'Sem documentação README disponível.',
                license: (typeof info.license === 'object' ? (info.license as any).type : info.license) || 'Não especificada'
              });
            } catch (err) {
              logDebug(`Extension searchPanel: Error fetching package details for ${message.packageName}: ${(err as Error).message}`);
              vscode.window.showErrorMessage(`Erro ao carregar detalhes: ${(err as Error).message}`);
              this._panel.webview.postMessage({
                type: 'detailsError',
                packageName: message.packageName,
                error: (err as Error).message
              });
            }
            break;
          }
        }
      },
      null,
      this._disposables
    );
  }

  public sendInitialQuery(query: string) {
    this._panel.webview.postMessage({ type: 'triggerSearch', query });
  }

  public sendPackageDetailsTrigger(packageName: string) {
    this._panel.webview.postMessage({ type: 'triggerDetails', packageName });
  }

  public dispose() {
    SearchPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.WebviewPanel['webview']) {
    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buscar Bibliotecas de IA</title>
  <style>
    :root {
      --primary-gradient: linear-gradient(135deg, #6366f1, #06b6d4);
      --bg-dark: #0f0f15;
      --card-bg: #181825;
      --card-border: rgba(255, 255, 255, 0.08);
      --text-color: #cdd6f4;
      --text-muted: #a6adc8;
      --accent-color: #06b6d4;
      --button-bg: #6366f1;
    }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-color);
      margin: 0;
      padding: 30px;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 30px;
    }

    .title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 10px 0;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: inline-block;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin: 0;
    }

    /* Search Section */
    .search-container {
      display: flex;
      gap: 12px;
      margin-bottom: 40px;
    }

    .search-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #ffffff;
      padding: 14px 20px;
      font-size: 16px;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      border-color: var(--accent-color);
      box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
      outline: none;
    }

    .search-btn {
      background: var(--button-bg);
      color: #ffffff;
      border: none;
      padding: 0 24px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }

    select option {
      background-color: #181825;
      color: #ffffff;
    }

    /* Results Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card:hover {
      border-color: var(--accent-color);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(6, 182, 212, 0.08);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      word-break: break-all;
    }

    .card-title a {
      color: #ffffff;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .card-title a:hover {
      color: var(--accent-color);
    }

    .card-version {
      font-size: 12px;
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 8px;
      border-radius: 20px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .card-body {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 12px;
      flex-grow: 1;
    }

    .card-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .card-publisher {
      font-weight: 600;
      color: #e2e8f0;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .card-tag {
      font-size: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .card-tag:hover {
      background: rgba(6, 182, 212, 0.1);
      color: var(--accent-color);
      border-color: rgba(6, 182, 212, 0.2);
    }

    .card-links {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 11px;
    }

    .card-link-item {
      color: var(--accent-color);
      text-decoration: none;
      transition: opacity 0.2s ease;
    }

    .card-link-item:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    .card-footer {
      display: flex;
      justify-content: flex-end;
    }

    .card-btn {
      background: rgba(6, 182, 212, 0.1);
      color: var(--accent-color);
      border: 1px solid rgba(6, 182, 212, 0.2);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      text-align: center;
    }

    .card-btn:hover {
      background: var(--accent-color);
      color: #ffffff;
    }

    /* Modal Form Overlay */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .modal-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #ffffff;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
      font-weight: 500;
    }

    .form-group input, .form-group textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      color: #ffffff;
      padding: 10px;
      font-size: 13px;
    }

    .form-group input:focus, .form-group textarea:focus {
      border-color: var(--accent-color);
      outline: none;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
    }

    .cancel-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-color);
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }

    .save-btn {
      background: var(--accent-color);
      border: none;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }

    /* Loading Spinner */
    .loader {
      display: none;
      text-align: center;
      margin: 50px 0;
    }

    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: var(--accent-color);
      animation: spin 1s linear infinite;
      margin: 0 auto 10px auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Readme Markdown Styling */
    #detailsReadmeContainer h1, #detailsReadmeContainer h2, #detailsReadmeContainer h3 {
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 8px;
      margin-top: 24px;
      margin-bottom: 16px;
      color: #ffffff;
    }
    #detailsReadmeContainer h1 { font-size: 24px; }
    #detailsReadmeContainer h2 { font-size: 20px; }
    #detailsReadmeContainer h3 { font-size: 17px; }
    #detailsReadmeContainer p { margin-bottom: 16px; }
    #detailsReadmeContainer code {
      font-family: 'Courier New', Courier, monospace;
      background: rgba(255,255,255,0.08);
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 14px;
      color: #06b6d4;
    }
    #detailsReadmeContainer pre {
      background: #0f0f15;
      border: 1px solid var(--card-border);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    #detailsReadmeContainer pre code {
      background: transparent;
      padding: 0;
      color: #e2e8f0;
      font-size: 13px;
    }
    #detailsReadmeContainer blockquote {
      border-left: 4px solid var(--accent-color);
      margin: 0 0 16px 0;
      padding-left: 16px;
      color: var(--text-muted);
    }
    #detailsReadmeContainer ul, #detailsReadmeContainer ol {
      margin-bottom: 16px;
      padding-left: 20px;
    }
    #detailsReadmeContainer li {
      margin-bottom: 6px;
    }
    #detailsReadmeContainer a {
      color: var(--accent-color);
      text-decoration: none;
    }
    #detailsReadmeContainer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Pesquisar Pacotes NPM</h1>
      <p class="subtitle">Busque por ferramentas de IA ou outras bibliotecas públicas e adicione-as ao seu painel.</p>
    </div>

    <div class="search-container" style="flex-wrap: wrap;">
      <input type="text" id="searchInput" class="search-input" placeholder="Digite o termo da busca (ex: ag-kit, langchain)..." onkeydown="if(event.key === 'Enter') performSearch(0)" style="flex: 1; min-width: 250px;">
      
      <div style="display: flex; gap: 8px; align-items: center; min-width: 250px;">
        <select id="sortBySelect" style="flex: 1; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border); border-radius: 8px; color: #ffffff; padding: 14px 10px; font-size: 14px;" onchange="performSearch(0)">
          <option value="optimal">Optimal</option>
          <option value="popularity">Popularity</option>
          <option value="quality">Quality</option>
          <option value="maintenance">Maintenance</option>
        </select>
        
        <select id="pageSizeSelect" style="width: 110px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border); border-radius: 8px; color: #ffffff; padding: 14px 10px; font-size: 14px;" onchange="performSearch(0)">
          <option value="10">10 / pág</option>
          <option value="20" selected>20 / pág</option>
          <option value="50">50 / pág</option>
          <option value="100">100 / pág</option>
        </select>
      </div>

      <button class="search-btn" onclick="performSearch(0)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        Buscar
      </button>
    </div>

    <div class="loader" id="loader">
      <div class="spinner"></div>
      <div style="color: var(--text-muted); font-size: 14px;">Buscando no NPM registry...</div>
    </div>

    <div class="grid" id="resultsGrid">
      <!-- Cards de resultados renderizados aqui -->
    </div>

    <!-- Controles de Paginação -->
    <div id="paginationContainer" style="display: none; justify-content: center; align-items: center; gap: 15px; margin-top: 40px; margin-bottom: 20px;">
      <button class="cancel-btn" id="prevPageBtn" onclick="changePage(-1)" style="padding: 10px 20px;">Anterior</button>
      <span id="pageIndicator" style="font-weight: 600; color: #ffffff;">Página 1</span>
      <button class="cancel-btn" id="nextPageBtn" onclick="changePage(1)" style="padding: 10px 20px;">Próxima</button>
    </div>
  </div>

  <!-- Modal de Adicionar Biblioteca -->
  <div class="modal-overlay" id="addModal">
    <div class="modal">
      <h2 class="modal-title">Adicionar às Minhas Bibliotecas</h2>
      
      <input type="hidden" id="libId">
      <div class="form-group">
        <label>Nome da Biblioteca</label>
        <input type="text" id="libName">
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="libDesc" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label>Pacote NPM</label>
        <input type="text" id="libNpm">
      </div>
      <div class="form-group">
        <label>Comando de Instalação Local (Init)</label>
        <input type="text" id="libCmdInit">
      </div>
      <div class="form-group">
        <label>Comando de Instalação Global (Opcional)</label>
        <input type="text" id="libCmdGlobal">
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" onclick="closeModal()">Cancelar</button>
        <button class="save-btn" onclick="saveLibrary()">Adicionar</button>
      </div>
    </div>
  </div>

  <!-- Painel de Detalhes do Pacote -->
  <div id="detailsOverlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-dark); z-index: 2000; overflow-y: auto; padding: 40px 30px;">
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; margin-bottom: 30px;">
        <div>
          <h1 id="detailsPackageName" class="title" style="margin: 0; font-size: 26px;">Nome do Pacote</h1>
          <div id="detailsLicense" style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Licença: MIT</div>
        </div>
        <button class="cancel-btn" onclick="closeDetails()" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ← Voltar para Busca
        </button>
      </div>
      
      <div id="detailsReadmeContainer" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 30px; line-height: 1.7; font-size: 15px; color: #e2e8f0; word-break: break-word;">
        <!-- Markdown parsed HTML -->
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentPage = 0;

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'searchResults':
          renderResults(message.results);
          break;
        case 'triggerSearch':
          document.getElementById('searchInput').value = message.query;
          performSearch(0);
          break;
        case 'triggerDetails':
          viewPackageDetails(message.packageName);
          break;
        case 'packageDetails':
          displayPackageDetails(message.packageName, message.readme, message.license);
          break;
      }
    });

    function performSearch(page = 0) {
      const query = document.getElementById('searchInput').value;
      console.log('Webview searchPanel: performSearch query =', query, 'page =', page);
      if (!query.trim()) {
        console.log('Webview searchPanel: empty query, ignoring');
        return;
      }

      currentPage = page;
      document.getElementById('resultsGrid').innerHTML = '';
      document.getElementById('loader').style.display = 'block';
      document.getElementById('paginationContainer').style.display = 'none';

      const sortBy = document.getElementById('sortBySelect').value;
      const pageSize = parseInt(document.getElementById('pageSizeSelect').value, 10);

      console.log('Webview searchPanel: Posting searchPackages message to extension host');
      vscode.postMessage({
        type: 'searchPackages',
        query,
        page,
        sortBy,
        pageSize
      });
    }

    function changePage(direction) {
      const newPage = currentPage + direction;
      if (newPage < 0) return;
      performSearch(newPage);
    }

    function renderResults(results) {
      console.log('Webview searchPanel: renderResults called with results:', results);
      document.getElementById('loader').style.display = 'none';
      const grid = document.getElementById('resultsGrid');
      grid.innerHTML = '';

      const pageSize = parseInt(document.getElementById('pageSizeSelect').value, 10);

      if (!results || results.length === 0) {
        console.log('Webview searchPanel: results is empty or undefined');
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px; font-size: 15px;">Nenhum pacote encontrado para o termo pesquisado.</div>';
        return;
      }

      results.forEach(pkg => {
        const card = document.createElement('div');
        card.className = 'card';

        // Format Date
        let dateStr = '';
        if (pkg.date) {
          dateStr = new Date(pkg.date).toLocaleDateString('pt-BR');
        }

        // Keywords HTML
        let keywordsHtml = '';
        if (pkg.keywords && pkg.keywords.length > 0) {
          keywordsHtml = '<div class="card-tags">';
          pkg.keywords.slice(0, 5).forEach(kw => {
            keywordsHtml += '<span class="card-tag">' + escapeHtml(kw) + '</span>';
          });
          keywordsHtml += '</div>';
        }

        // Links HTML
        let linksHtml = '<div class="card-links">';
        if (pkg.links) {
          if (pkg.links.npm) {
            linksHtml += '<a class="card-link-item" href="' + pkg.links.npm + '" target="_blank">NPM</a>';
          }
          if (pkg.links.repository) {
            linksHtml += '<a class="card-link-item" href="' + pkg.links.repository + '" target="_blank">GitHub</a>';
          }
          if (pkg.links.homepage) {
            linksHtml += '<a class="card-link-item" href="' + pkg.links.homepage + '" target="_blank">Homepage</a>';
          }
        }
        linksHtml += '</div>';

        // Publisher block
        let publisherHtml = '';
        if (pkg.publisher && pkg.publisher.username) {
          publisherHtml = '<div class="card-meta">Publicado por <span class="card-publisher">@' + escapeHtml(pkg.publisher.username) + '</span>' + (dateStr ? ' em ' + dateStr : '') + '</div>';
        }

        card.innerHTML = \`
          <div style="display:flex; flex-direction:column; height:100%;">
            <div class="card-header">
              <span class="card-title"><a href="#" onclick="viewPackageDetails('\${escapeHtml(pkg.name)}'); return false;">\${escapeHtml(pkg.name)}</a></span>
              <span class="card-version">v\${escapeHtml(pkg.version)}</span>
            </div>
            \${publisherHtml}
            <div class="card-body">\${escapeHtml(pkg.description || 'Sem descrição cadastrada.')}</div>
            \${keywordsHtml}
            \${linksHtml}
            <div class="card-footer" style="margin-top:auto; width:100%;">
              <button class="card-btn" onclick="openAddModal('\${escapeHtml(pkg.name)}', '\${escapeHtml(pkg.description || "")}')">Adicionar à Lista</button>
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });

      // Update pagination controls
      document.getElementById('paginationContainer').style.display = 'flex';
      document.getElementById('pageIndicator').innerText = 'Página ' + (currentPage + 1);
      
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      
      prevBtn.disabled = currentPage === 0;
      nextBtn.disabled = results.length < pageSize;
    }

    function openAddModal(name, description) {
      document.getElementById('libId').value = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      document.getElementById('libName').value = name;
      document.getElementById('libDesc').value = description;
      document.getElementById('libNpm').value = name;
      document.getElementById('libCmdInit').value = 'npx ' + name + ' init';
      document.getElementById('libCmdGlobal').value = 'npm install -g ' + name;
      
      document.getElementById('addModal').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('addModal').style.display = 'none';
    }

    function saveLibrary() {
      const name = document.getElementById('libName').value;
      const desc = document.getElementById('libDesc').value;
      const initCmd = document.getElementById('libCmdInit').value;

      if (!name || !desc || !initCmd) {
        alert('Nome, Descrição e Comando Init são campos obrigatórios.');
        return;
      }

      const id = document.getElementById('libId').value || name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      const library = {
        id,
        name,
        description: desc,
        npmPackage: document.getElementById('libNpm').value || undefined,
        commands: {
          init: initCmd,
          global: document.getElementById('libCmdGlobal').value || undefined
        },
        currentVersion: '1.0.0'
      };

      vscode.postMessage({ type: 'addLibrary', library });
      closeModal();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function viewPackageDetails(packageName) {
      document.getElementById('detailsOverlay').style.display = 'block';
      document.getElementById('detailsPackageName').innerText = packageName;
      document.getElementById('detailsLicense').innerText = 'Carregando...';
      document.getElementById('detailsReadmeContainer').innerHTML = '<div style="text-align:center; padding:50px;"><div class="spinner"></div><br>Carregando documentação...</div>';
      
      vscode.postMessage({ type: 'getPackageDetails', packageName });
    }

    function closeDetails() {
      document.getElementById('detailsOverlay').style.display = 'none';
    }

    function displayPackageDetails(name, readme, license) {
      document.getElementById('detailsPackageName').innerText = name;
      document.getElementById('detailsLicense').innerText = 'Licença: ' + license;
      document.getElementById('detailsReadmeContainer').innerHTML = parseMarkdownToHtml(readme);
    }

    function parseMarkdownToHtml(md) {
      if (!md) return 'Sem documentação README disponível.';
      
      let html = md;
      
      // Escape HTML entities to prevent script injection but keep code blocks
      html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      // Code blocks
      html = html.replace(new RegExp('\`{3}([\\\\s\\\\S]*?)\`{3}', 'g'), (match, code) => {
        return '<pre><code>' + code.trim() + '</code></pre>';
      });
      
      // Inline code
      html = html.replace(new RegExp('\`([^\`]+)\`', 'g'), '<code>$1</code>');
      
      // Headers (H3 to H1)
      html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
      
      // Bold (**bold**)
      html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      
      // Italics (*italics*)
      html = html.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
      
      // Links ([text](url))
      html = html.replace(/\\\[(.*?)\\\]\\((.*?)\\)/g, '<a href="$2" target="_blank">$1</a>');
      
      // Blockquotes (> text)
      html = html.replace(/^&gt;[ ]?(.*?)$/gm, '<blockquote>$1</blockquote>');
      
      // Unordered lists (- or * items)
      html = html.replace(/^[\\-*][ ]?(.*?)$/gm, '<li>$1</li>');
      // Wrap consecutive <li> elements in <ul>
      html = html.replace(/((?:<li>[\\\\s\\\\S]*?<\\/li>\\\\s*)+)/g, '<ul>$1</ul>');
      
      // Replace double newlines with paragraphs, others with br
      html = html.replace(/\\n\\n/g, '</p><p>');
      html = html.replace(/\\n/g, '<br>');
      
      return '<p>' + html + '</p>';
    }
  </script>
</body>
</html>`;
  }
}
