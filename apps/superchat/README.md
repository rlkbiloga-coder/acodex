# Superchat — clone nativo do chat Base44 Superagent

Clone em React da interface de chat do Base44 Superagent (app.base44.com/superagent/&lt;id&gt;), com o backend mapeado na API pública de agentes.

## Rotas
- `/` — conversa padrão (mensagens, raciocínio colapsável, composer com anexo)
- `/conversations` — lista de conversas (`GET /conversations`)
- `/memory` — memória do agente e configuração local (agentId + apiKey ficam no localStorage)

## Backend mapeado (API pública)
- Base: `https://app.base44.com/api/agents/<agent_id>`
- `GET /conversations`, `POST /conversations`
- `POST /conversations/{id}/messages` (retorna a resposta do agente)
- `GET /memory`, `DELETE /conversations/{id}/messages/{mid}`
- Auth: header `Authorization: Bearer <key>` (Developer tab do agente)

## Engenharia e práticas
- Vite + React 18 + react-router; componentes puros e pequenos
- Cliente de API isolado e injetável (`src/api/agentApi.js`) — testável sem rede
- Testes de componente com Testing Library + Vitest (`npm test`)
- Lint: Biome (`npm run lint`)
- Sem estado global: props + localStorage; hooks pequenos
- Acessibilidade: labels, roles de alerta, navegação por teclado

## Uso
```
npm install
npm run dev     # http://localhost:5174
npm test
npm run build
```
Em `/memory`, informe o `agentId` e a `apiKey` do seu Superagent.
