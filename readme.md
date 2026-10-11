# AcodeX — IDE • Code • Build

<p align="center">
  <img src="res/logo_1.png" width="180">
</p>

<p align="center">
  <strong>IDE completa para Android: editor, terminal, plugins e build no bolso.</strong>
</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white">
  <img alt="language" src="https://img.shields.io/badge/stack-JavaScript%20%2B%20TypeScript-f7df1e?logo=javascript&logoColor=black">
  <img alt="editor" src="https://img.shields.io/badge/editor-CodeMirror%206-222?logo=codeberg">
  <img alt="tests" src="https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="lint" src="https://img.shields.io/badge/lint-Biome-60a5fa">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
</p>

---

## 📖 Visão geral

AcodeX é um editor de código e IDE completa para Android, construída a partir do projeto open-source [Acode](https://github.com/Acode-Foundation/Acode). Edite HTML, CSS, JavaScript, Python, Java e dezenas de outras linguagens direto no celular, com terminal emulado, cliente S/FTP, suporte a LSP e um ecossistema de plugins.

> [!NOTE]
> Clone com `--recurse-submodules` — o cliente LSP do CodeMirror vive no submódulo `codemirror-lsp-client/`.

## ✨ Features

**Editor**
- Syntax highlighting para 100+ linguagens via CodeMirror 6 + Lezer
- LSP (Language Server Protocol) com autocompletar, go-to-definition e diagnósticos
- Preview instantâneo de sites no navegador embutido
- Multi-idioma (i18n) com ferramentas de gerenciamento em CLI
- Temas, quicktools e console JavaScript embutido

**Terminal & runtime**
- Terminal emulado (Alpine) com suporte a execução de comandos
- Console JavaScript com execução no contexto da sessão
- Execução de Python e outras linguagens via plugins

**Conectividade**
- S/FTP e terminal SSH integrados
- Cliente git embutido
- Explorador de arquivos com suporte a armazenamento externo (SD card)

**Extensibilidade**
- Sistema de plugins compatível com o ecossistema Acode
- Grande coleção de plugins da comunidade

## 🏗️ Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  Cordova WebView (Android)                                   │
│                                                              │
│  src/                                                        │
│  ├── main.js / boot.js   ── ponto de entrada e bootstrap     │
│  ├── components/         ── blocos de UI (sidebar, editor)   │
│  ├── pages/              ── telas (welcome, about, ...)      │
│  ├── dialogs/            ── caixas de diálogo                │
│  ├── handlers/           ── comandos e eventos do editor     │
│  ├── lib/                ── núcleo: settings, editorManager  │
│  ├── cm/                 ── integração CodeMirror 6 + LSP     │
│  ├── plugins/            ── plugins nativos (terminal, admob)│
│  ├── sidebarApps/        ── apps da sidebar (arquivos, git)  │
│  ├── utils/ & handlers/  ── utilitários e command handlers    │
│  └── lang/               ── pacotes de idioma                 │
│                                                              │
│  www/build/   ← saída do bundle (Rspack) carregada no WebView │
└─────────────────────────────────────────────────────────────┘
```

**Fluxo de build:** `src/` → **Rspack** (ou Webpack) → `www/build/` → **Cordova** → APK/AAB Android.

## 📂 Estrutura do projeto

| Caminho | Descrição |
|---|---|
| `src/` | Código principal do app e arquivos de idioma |
| `tests/` | Testes unitários e de integração (Vitest) |
| `src/test/` | Harness de testes *runtime* do app (roda on-device no WebView — não é coletado pelo Vitest) |
| `www/` | Documentos públicos, bundle compilado e templates HTML |
| `utils/` | Ferramentas de CLI: build, i18n, manipulação de strings |
| `codemirror-lsp-client/` | Submódulo git: `@codemirror/lsp-client` |
| `docs/` | Documentação técnica e referências |
| `fastlane/` | Metadados de publicação nas lojas |
| `.github/` | Workflows de CI |

## 🚀 Quick start

```bash
# 1. Clone com submódulos
git clone --recurse-submodules https://github.com/rlkbiloga-coder/acodex.git
cd acodex

# 2. Instale dependências
npm install        # ou: bun install

# 3. Setup inicial do ambiente
npm run setup

# 4. Ambiente de desenvolvimento (live reload)
npm run dev        # web
npm run dev:android  # device/emulador Android
```

### Scripts principais

| Comando | Descrição |
|---|---|
| `npm run dev` | Ambiente de dev com live reload |
| `npm run build` | Build completo (web + Android via Cordova) |
| `npm run test` | Roda a suíte de testes com Vitest |
| `npm run test:watch` | Vitest em modo watch |
| `npm run typecheck` | Verificação de tipos TypeScript (`tsc --noEmit`) |
| `npm run check` | Lint + format com Biome (auto-fix) |
| `npm run lang` | Ferramentas de gestão de i18n |

## 🧪 Testes

- **`tests/`** — suíte unitária/integração rodada pelo **Vitest** (`npm test`). Espelha a resolução de módulos do bundler (aliases `utils/…`, `lib/…` → `src/…`).
- **`src/test/`** — harness de testes *runtime* que roda on-device dentro do WebView (lançado pelos comandos do app). Depende de globais do Cordova/editorManager e é **excluído** da coleta do Vitest por design.

## 🌍 Multi-language support

Adicione novos idiomas criando um arquivo com o código do idioma (ex.: `en-us` para inglês) em `src/lang/` e registrando-o em `src/lib/lang.js`. Gerencie strings com a CLI:

```shell
npm run lang add
npm run lang remove
npm run lang search
npm run lang update
```

## 🔌 Desenvolvendo plugins

AcodeX mantém compatibilidade com o sistema de plugins do Acode.

- Documentação de plugins: [docs.acode.app](https://docs.acode.app/)
- Template e referência de API: [acode-plugin](https://github.com/Acode-Foundation/acode-plugin)

Para plugins nativos internos (terminal, admob), veja `src/plugins/` e a ferramenta `npm run plugin`.

## 🤝 Contribuindo

Issues e PRs são bem-vindos! Para o fluxo completo de build e contribuição, veja [CONTRIBUTING.md](CONTRIBUTING.md).

Padrões de código:
- **Biome** para lint e formatação (`npm run check`)
- **TypeScript** com `typecheck` obrigatório antes do commit
- Todo bugfix relevante deve vir acompanhado de teste em `tests/`

## 📜 Créditos e licença

AcodeX é baseado no projeto open-source [Acode](https://github.com/Acode-Foundation/Acode), da Foxdebug / Acode Foundation, distribuído sob licença MIT. Agradecimentos a toda a comunidade de contribuidores do projeto original.

Este projeto é distribuído sob a licença MIT — veja [license.txt](license.txt).
