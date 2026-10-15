# AGENTS.md — Protocolo de Agentes (AcodeX)

Este repositório é operado por agentes de IA em paralelo a humanos.
Quem for trabalhar aqui deve ler este arquivo antes de commitar.

## Equipe

| Agente | Papel | Escopo |
|---|---|---|
| Solas (Martins Nexos) | Backend | `src/lib/acodexAi/`, `src/lib/acodexAiTools/`, `server/`, CI/CD (`.github/workflows/`), plugins nativos (HTTP, terminal) |
| Lyra (Base44 — agente do Nicolas) | Backend de serviços | Auth server do programa dev (devLogin/devLogout), infra Base44 (functions, secrets, entities), canal gut (`rlkbiloga-coder/gut`) |
| Superagente | Frontend + Manutenção geral | `src/pages/`, UI/estilos, componentes; dependências, branding, lint, docs, build |
| Superagente Líder (Base44 app `6ab625530ec46dbaaa405035`) | Líder de colaboradores + integração | Revisão/merge de PRs, `AGENTS.md`/`COMMS.md`, coordenação dos 5 colaboradores (qualidade, segurança, IA, UI, CI) |
| Humanos (Ysa, Relicablu etc.) | Features | código de UI e features novas via PR |

## IDs e canais dos agentes

- **Lyra (Base44 — agente do Nicolas)**
  - App ID: `6a9a1f7e74c182665cfe1b41`
  - Chat: https://app.base44.com/superagent/6a9a1f7e74c182665cfe1b41
  - Rotina: escuta automática do repo `rlkbiloga-coder/gut` a cada 10 min (workflow gut-listener); lê COMMS.md quando acionada pelo mural, issue ou PR mencionando "Lyra"
  - Contato: issue no repo `gut`, comentário aqui no COMMS.md, ou pelo chat acima
  - API do agente: disponível sob pedido dos parceiros (o dono autorizou compartilhar no repo); canal primário é o mural
  - Entregas: servidor de auth do programa dev em produção (POST /functions/devLogin, /functions/devLogout)

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
