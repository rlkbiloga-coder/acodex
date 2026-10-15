# AcodeX Live Browser (open source, self-hosted)

Navegador controlado pelo agente do AcodeX IA. O app roda no celular e
controla um Chromium real rodando no seu servidor (Docker), via REST +
WebSocket. 100% open source: Node.js, Express, Playwright e Chromium.

```
App (Android) ──REST/WS──> Node + Playwright ──> Chromium headless
```

O navegador roda no backend, não dentro do WebView do Android. O app
mostra screenshots e envia os comandos.

## Como subir (Docker)

```bash
cd server/live-browser
echo "ACX_BROWSER_TOKEN=$(openssl rand -hex 32)" > .env
docker compose up --build -d
```

Health: `http://localhost:3000/health`

No celular, aponte o painel (Acodex IA > ícone de navegador) para o IP da
sua máquina na mesma rede, ex.: `http://192.168.1.20:3000`, com o token
gerado acima.

IMPORTANTE: não exponha este serviço na internet pública sem HTTPS,
autenticação adicional e isolamento por sessão. Ele foi pensado para uso
em rede local ou atrás de um proxy seguro.

## API

- `GET /health` — status do serviço
- `GET /api/config` — capacidades (auth ativo, terminal, limites)
- `POST /api/browser/sessions` — cria sessão
- `POST /api/browser/:id/navigate` `{ "url": "https://example.com" }`
- `GET /api/browser/:id/state` — url, título, texto da página
- `GET /api/browser/:id/screenshot` — PNG
- `POST /api/browser/:id/click` `{ "selector": "text=Saiba mais" }`
- `POST /api/browser/:id/fill` `{ "selector": "input[name=q]", "value": "oi" }`
- `POST /api/browser/:id/close`

Ações sensíveis: envie `requiresApproval: true` e o backend responde
`APPROVAL_REQUIRED` (409) sem executar. Repita com `approved: true` só
depois de aprovar na UI. Nunca aprove automaticamente pagamentos, envio
de mensagens ou alterações de conta.

## Ferramentas do agente

Registradas no Acodex IA quando o servidor está configurado:

- `browser_create_session`
- `browser_navigate`
- `browser_get_state`
- `browser_screenshot`
- `browser_click`
- `browser_fill`

O modelo nunca recebe shell arbitrário. Todo argumento é validado no
servidor; conteúdo de páginas é dado não-confiável, nunca instrução.

## Segurança embutida

1. Token `x-acx-token` em todas as rotas REST e no handshake WS
2. Guard SSRF: destinos locais/privados e metadata de cloud bloqueados
3. Limite de sessões simultâneas e de criação por IP
4. Terminal restrito a allowlist, off por padrão
5. Limites de memória/CPU no compose, TTL de sessão com limpeza automática
6. CORS configurável via `ALLOWED_ORIGIN`
