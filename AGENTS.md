# AGENTS.md — Protocolo de Agentes (AcodeX)

Este repositório é operado por agentes de IA em paralelo a humanos.
Quem for trabalhar aqui deve ler este arquivo antes de commitar.

## Equipe

| Agente | Papel | Escopo |
|---|---|---|
| Solas (Martins Nexos) | Backend + Suporte (repo e app) | `src/lib/acodexAi/`, `src/lib/acodexAiTools/`, `server/`, CI/CD (`.github/workflows/`), plugins nativos (HTTP, terminal); suporte a agentes: deps, build, helper acodex-b44, registry |
| Lyra (Base44 — agente do Nicolas) | Backend de serviços | Auth server do programa dev (devLogin/devLogout), infra Base44 (functions, secrets, entities), canal gut (`rlkbiloga-coder/gut`) |
| Superagente (Ncio, Base44) | Frontend + Manutenção geral | `src/pages/`, UI/estilos, componentes; dependências, branding, lint, docs, build |
| Superagente (Geiza, Base44) | Frontend + Monitoria técnica | UI/estilos (missão F1-F10, issue #38), ronda de monitoria dos repositórios (9h/18h BRT) |
| Superagente Líder (Base44 app `6ab625530ec46dbaaa405035`) | Líder de colaboradores + integração | Revisão/merge de PRs, `AGENTS.md`/`COMMS.md`, coordenação dos 5 colaboradores (qualidade, segurança, IA, UI, CI) |
| Humanos (Ysa, Relicablu etc.) | Features | código de UI e features novas via PR |

## IDs e canais dos agentes

- **Solas (Base44 — agente do Martins Nexos)**
  - App ID: `6a9d897805e878cd9cbe4209`
  - Chat: https://app.base44.com/superagent/6a9d897805e878cd9cbe4209
  - Rotina: acionado pelo WhatsApp do dono (Martins Nexos) e por tarefas do repo; lê COMMS.md no início de cada tarefa
  - Comandos: atende comandos da equipe (mural, issue/PR, chat/API); o Superagente Líder (`6ab625530ec46dbaaa405035`) pode conceder permissões em nome do dono
  - Suporte: mantém deps, build, CI e acodex-b44 funcionando para os demais agentes e para si mesmo
  - Contato: WhatsApp do Martins Nexos, mensagem no COMMS.md, comentário em issue/PR mencionando "Solas"
  - API do agente: disponível sob pedido dos parceiros; a chave NUNCA vai no repo — no AcodeX o acodex-b44 preenche este App ID por padrão e cada usuário grava a própria chave criptografada no aparelho (--setup) ou via GitHub Secret
  - Entregas: keystore fixo no CI, pool NVIDIA com rotação automática, securityMonitor (rate limit/anti-bot/auditoria), nativeFetch anti-CORS, splash neon com logo transparente, registro base44-superagent no AGENT_REGISTRY

- **Lyra (Base44 — agente do Nicolas)**
  - App ID: `6a9a1f7e74c182665cfe1b41`
  - Chat: https://app.base44.com/superagent/6a9a1f7e74c182665cfe1b41
  - Rotina: escuta automática do repo `rlkbiloga-coder/gut` a cada 10 min (workflow gut-listener); lê COMMS.md quando acionada pelo mural, issue ou PR mencionando "Lyra"
  - Contato: issue no repo `gut`, comentário aqui no COMMS.md, ou pelo chat acima
  - API do agente: disponível sob pedido dos parceiros (o dono autorizou compartilhar no repo); canal primário é o mural
  - Comandos: parceiros podem enviar comandos ao Superagente via COMMS.md, issue ou PR; ele responde e executa quando o comando chegar
  - Permissões: decisões de permissão/autorização dentro do escopo do repo podem ser concedidas pelo Superagente líder (autorização do dono, 2026-10-15)
  - Entregas: servidor de auth do programa dev em produção (POST /functions/devLogin, /functions/devLogout)

- **Superagente (Base44 — agente da Geiza)**
  - App ID: `6ab67c8cce89ca33ff6ee7b9`
  - Chat: https://app.base44.com/superagent/6ab67c8cce89ca33ff6ee7b9
  - Rotina: Ronda Acodex às 9h e 18h (America/Sao_Paulo) — varre este repo e o Thcode (leitura), corrige problemas mecânicos (CI, lint, deps) e lê COMMS.md/issues/PRs
  - Contato: WhatsApp da Geiza, mensagem no COMMS.md, comentário em issue/PR mencionando "Superagente (Geiza)"
  - Comandos: mensagens endereçadas a "Superagente (Geiza)" no COMMS.md/issues são tratadas na ronda seguinte (ou antes via WhatsApp da Geiza); permissões especiais podem ser concedidas pelo Superagente Líder
  - API do agente: disponível sob pedido dos parceiros; chave via GitHub Secret (nunca no repo)
  - Entregas: missão de UI F1-F10 (tokens, toast, paleta de comandos, terminal, etc.), correções de CI/lint/deps

- **Superagente (Base44 — agente do Ncio Marri)**
  - App ID: `6ab634148da6b3f541edaf4b`
  - Chat: https://app.base44.com/superagent/6ab634148da6b3f541edaf4b
  - Rotina: check diário 09:00 BRT (workflow "Acodex Sentinela") — lê COMMS.md, issues e PRs
  - Contato: mensagem no COMMS.md, comentário em issue/PR mencionando "Superagente", ou pelo chat acima
  - API do agente: disponível sob pedido dos parceiros (o dono autorizou compartilhar no repo); canal primário é o mural

## Regras

1. Não comite direto em área do outro agente sem avisar em `COMMS.md`.
2. Antes de começar qualquer tarefa, leia `COMMS.md` (mensagens não lidas no topo).
3. Ao INICIAR e ao terminar uma tarefa (ou precisar de algo), deixe mensagem em `COMMS.md`. Transparência total: o que você está fazendo agora fica sempre visível no mural. (Decisão da Geiza, 2026-10-10.)
4. Toda mensagem deve ter: `@destinatário`, autor, data/hora (UTC) e tópico.
5. Ao responder, marque a mensagem original como respondida (risca o item `~-Respondido~`).
6. Nunca comite segredos. Credenciais ficam no cofre `acodex-secrets` ou em GitHub secrets.

## Decisões registradas (fonte da verdade)

- 2026-10-10: HTTP nativo (advanced-http) nas chamadas IA — CORS bloqueia fetch no WebView Android.
- 2026-10-10: Keystore debug persistente via actions/cache — assinatura fixa entre builds.
- 2026-10-10: Chave NVIDIA embutida via secret `NVAPI_BUILTIN` no build; chave local do usuário sempre tem prioridade.
- 2026-10-10: Solas é o dono do backend. Mudanças de contrato em `src/lib/acodexAi/` precisam de mensagem prévia em COMMS.md.

## Ambiente de dev no sandbox Base44 (preview web)

Não óbvio, e o resto dos manifests não diz:

- **Submódulo primeiro.** `codemirror-lsp-client/` é submódulo e a dependência
  `file:codemirror-lsp-client` do package.json. O checkout do Base44 vem sem os
  arquivos do submódulo, então `npm ci` falha até rodar
  `git submodule update --init --recursive`.
- **Subir:** `docker compose -f docker-compose.base44.yml up -d` (o `--build` só
  refaz o pull das imagens base). Serviços: `builder` (node:22, `npm ci` a partir
  do `package-lock.json` e `rspack --watch` -> `www/build/`) e `web` (nginx
  servindo `www/` na porta 3000). O primeiro boot leva ~40-60 s (instalação de
  deps + build) e o `web` só fica healthy depois que o bundle existe.
- **Não rode `node utils/config.js` aqui.** Ele é o passo de variante do build
  Android e reescreve identidade versionada: troca o id do `config.xml`
  (`com.acodex.editor` -> `com.foxdebug.acode`) e sobrescreve
  `res/android/values/ic_launcher_background.xml`. O preview web não precisa dele
  (só de `utils/scripts/web-cordova-shim.js` + `rspack`).
- **Sem credenciais para bootar.** O preview é o build web do projeto e sobe sem
  nenhum segredo. `NVAPI_BUILTIN`/`NVAPI_POOL` são injetados pelo
  `.github/workflows/build-apk.yml` no build do APK; no navegador as chaves de IA
  são digitadas pelo usuário no próprio app.
- **Nada de live reload na página.** O harness de dev do projeto
  (`utils/scripts/dev.js`) depende de um device Android conectado e sorteia porta,
  por isso o preview usa o caminho web + nginx. Depois de editar: espere o rebuild
  em `docker compose -f docker-compose.base44.yml logs -f builder` e recarregue o
  preview (o `rspack --watch` recompila sozinho, em ~5 s).
- **Plugins nativos não existem no navegador** (terminal, filesystem, SMB/FTP,
  advanced-http, ads): `www/cordova.js` é o stub de browser gerado pelo shim, então
  esses recursos falham do jeito deles — a UI do editor carrega normalmente.
- **O shim é passo de boot, não do watcher.** `www/cordova.js` só é gerado quando o
  serviço `builder` sobe; depois de editar `utils/scripts/web-cordova-shim.js` rode
  `docker compose -f docker-compose.base44.yml restart builder`, senão o preview
  serve o stub antigo e o app morre no boot com `<global> is not defined`.
- **Ruído esperado no console do preview** (não é bug do app): 404 de
  `/_vercel/insights/script.js` (o analytics da Vercel não existe fora da Vercel) e
  `fetch` bloqueado por CORS para `acode.app/api/login` e `acode.app/api/promotions`
  (login/promoções não têm back-end aqui). O boot segue normal.
- **Verificar / testar:**
  ```sh
  curl -sfI http://localhost:3000/            # index.html
  curl -sfI http://localhost:3000/build/main.js
  docker compose -f docker-compose.base44.yml exec builder npx vitest run
  docker compose -f docker-compose.base44.yml exec builder npx tsc --noEmit
  ```
- **BASE44_PREVIEW_MODE:** nenhum override de código/config foi necessário — nginx
  aceita qualquer Host e o proxy do preview alcança a porta 3000 direto. O flag
  segue obrigatório para qualquer override de sandbox que venha a ser adicionado
  (gate exato em `"1"`, comportamento original preservado quando ausente).
