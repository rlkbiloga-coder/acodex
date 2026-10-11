# Esqueleto de backup do Acode

Referência completa da estrutura do projeto Acode (upstream `Acode-Foundation/Acode`), para backup e consulta rápida. Última verificação: commit `a63983f` (main, 2026-09-28).

## Raiz do projeto

| Caminho | O que é |
|---|---|
| `config.xml` | Configuração Cordova: id do pacote, versão, nome do app, plugins |
| `package.json` | Dependências e scripts de build do app web |
| `webpack.config.js` / `rspack.config.js` | Bundlers que compilam o `src/` para `www/build/` |
| `res/` | Recursos nativos: logos Android (mipmap), splash, ícones |
| `www/` | Build pronto do app web (o que o WebView carrega) |
| `codemirror-lsp-client/` | Submódulo git: cliente LSP do CodeMirror |
| `fastlane/` | Metadados de publicação nas lojas |
| `gradle/` | Wrapper do Gradle para o build Android |
| `hooks/` | Hooks do Cordova (pós-processo do build) |
| `tests/` | Testes unitários (Vitest) e helpers de teste |
| `utils/` | Scripts utilitários do build (variantes free/paid, setup) |
| `.github/workflows/` | CI do upstream: ci, nightly-build, nightly-release etc. |

## src/ (código do app)

| Pasta | O que é |
|---|---|
| `main.js` / `boot.js` | Ponto de entrada e inicialização do app |
| `components/` | Blocos de UI: sidebar, editor, logo, página, menu |
| `pages/` | Telas: welcome (boas-vindas), about (sobre), editores auxiliares |
| `dialogs/` | Caixas de diálogo: confirmar, alerta, rate (avaliação), pagamento |
| `handlers/` | Manipuladores de comandos e eventos do editor |
| `fileSystem/` | Camada de arquivos: internal, external, FTP, SFTP, armazenamentos |
| `lib/` | Núcleo: config, logger, commands, actionStack, editorManager, logger |
| `settings/` | Telas e modelos das configurações do app |
| `sidebarApps/` | Apps da barra lateral (arquivos, plugins, etc.) |
| `cm/` | Extensões do CodeMirror (o motor de edição novo) |
| `ace/` (em `lib/`) | Integração com Ace (motor de edição clássico) |
| `lang/` | Traduções: 33+ arquivos `xx-xx.json` |
| `palettes/` | Paletas de cores do editor |
| `plugins/` | Plugins internos embarcados: terminal, proot, sftp, auth, system, browser, custom-tabs, pluginContext, keybind, settings |
| `theme/` | Definições de temas (claro/escuro) |
| `views/` | Templates Handlebars de views (console, markdown, menus) |
| `styles/` | SCSS utilitários globais |
| `utils/` | Helpers JS (helpers.js, tasks, etc.) |

## Plugins internos (`src/plugins/`)

| Plugin | Função |
|---|---|
| `terminal` | Terminal integrado (Android Runtime + proot) |
| `proot` | Root fake para rodar distribuições Linux no terminal |
| `auth` | Autenticação do usuário (acode.app) |
| `system` | Recursos do sistema Android, recompensas, anúncios |
| `browser` / `custom-tabs` | Navegador in-app e abas personalizadas |
| `sftp` | Cliente SFTP |
| `pluginContext` | Contexto para plugins de terceiros |
| `keybind` | Atalhos de teclado |
| `settings` | Persistência das configurações |

## Fluxo de build (resumo)

1. `npm install` instala dependências
2. `node utils/config.js dev paid` (ou `free`) ajusta a variante
3. `rspack`/`webpack` compila `src/` para `www/build/`
4. `cordova build android` empacota o `www/` no APK
5. GitHub Actions (`.github/workflows/`) faz isso no CI

## Onde estão os textos editáveis

1. Nome/descrição do app: `config.xml`
2. Textos da interface: `src/lang/*.json` (chave `appname` = nome do app)
3. Tela de boas-vindas: `src/pages/welcome/`
4. Tela Sobre: `src/pages/about/`
5. HTML carregado pelo WebView: `www/index.html`

Para testar o app no navegador sem compilar nada, abra `testes/acode-web.html`.
