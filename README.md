# AI Library Manager

[English](#english) | [Português](#portugues)

---

<a name="english"></a>
## English

**AI Library Manager** is a VS Code extension designed to help you search, save, install, and manage AI tools, libraries, and SDKs. Keep your development stack organized and synchronized across different workspaces and machines.

### 🚀 Features

- 🔍 **NPM Package Search**: Search for NPM packages (such as LangChain, LlamaIndex, or agent toolkits) directly inside VS Code and save them to your custom library list.
- 📦 **Local & Global Installation**: Install packages with a single click, supporting custom initialization commands (e.g., `npx library-name init`) or global CLI commands.
- 🔄 **GitHub Gist Sychronization**: Backup and restore your customized list of libraries using a GitHub Personal Access Token (PAT).
- 🔔 **Outdated Version Alerts**: Automatically check if your open project uses outdated versions of your registered libraries, comparing local package versions with their registry defaults.
- 🎨 **Modern & Adaptive UI**: Premium sidebar and search webview designs that match the look and feel of your active VS Code theme, complete with micro-interactions and status badges.

### ⚙️ Configuration

To sync your libraries across devices using GitHub Gist:
1. Create a GitHub Personal Access Token (PAT) with `gist` scope.
   - > [!IMPORTANT]
     > Use **Tokens (classic)**. Fine-grained tokens currently do *not* support Gist access.
2. In the AI Libraries sidebar panel, click **Backup Gist** or **Restore Gist**.
3. Paste your GitHub PAT.
4. For restoring, paste the **Gist ID** generated during your first backup.

---

<a name="portugues"></a>
## Português

O **AI Library Manager** é uma extensão para o VS Code desenvolvida para ajudar você a buscar, salvar, instalar e gerenciar ferramentas, bibliotecas e SDKs de inteligência artificial. Mantenha seu ecossistema de desenvolvimento organizado e sincronizado em múltiplos ambientes.

### 🚀 Funcionalidades

- 🔍 **Busca de Pacotes NPM**: Pesquise pacotes do NPM (como LangChain, LlamaIndex ou ferramentas para agentes) diretamente do editor e adicione-os à sua lista personalizada.
- 📦 **Instalação Local e Global**: Instale bibliotecas com um único clique, com suporte a comandos customizados de inicialização (ex: `npx library-name init`) ou instalações globais via CLI.
- 🔄 **Sincronização via GitHub Gist**: Salve backups e restaure sua lista de bibliotecas preferidas em outras máquinas através de um Token de Acesso Pessoal (PAT) do GitHub.
- 🔔 **Alertas de Atualização**: Verifique de forma automática se o projeto aberto possui versões desatualizadas de suas bibliotecas salvas em relação à versão mais recente do NPM.
- 🎨 **Interface Moderna**: Painéis na barra lateral e aba de buscas com design adaptável e integrado ao tema ativo do VS Code, com micro-animações e badges de status informativos.

### ⚙️ Configuração

Para sincronizar suas bibliotecas favoritas em múltiplos computadores usando o GitHub Gist:
1. Crie um Token de Acesso Pessoal (PAT) no GitHub com a permissão `gist`.
   - > [!IMPORTANT]
     > Selecione a opção de **Tokens (classic)**. Tokens do tipo "Fine-grained" atualmente *não* têm suporte à API de Gist.
2. No painel lateral AI Libraries, clique em **Backup Gist** ou **Restore Gist**.
3. Insira o token gerado.
4. Para realizar a restauração em outro computador, insira também o **ID do Gist** gerado no primeiro backup.
