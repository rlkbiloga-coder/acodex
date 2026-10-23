/**
 * Mapeamento do backend Base44 Superagent (API pública de agentes).
 * Endpoints reais de /api/agents/<agent_id>:
 *   GET    /conversations                     -> lista/convite conversa padrão
 *   POST   /conversations                     -> cria conversa
 *   POST   /conversations/{id}/messages       -> envia mensagem (retorna resposta)
 *   GET    /memory                            -> memória visível via API
 *   DELETE /conversations/{id}/messages/{mid} -> apaga mensagem
 * Autenticação: header `api_key` (key do agente no editor Developer).
 */

const DEFAULT_BASE = "https://app.base44.com/api/agents";

/** Cliente configurável (baseUrl/key injetáveis para testes). */
export function createAgentClient({ agentId, apiKey, base = DEFAULT_BASE, fetchImpl = fetch }) {
  if (!agentId || !apiKey) {
    throw new Error("agentId e apiKey são obrigatórios");
  }
  const url = (path) => `${base}/${agentId}${path}`;
  const headers = { "Content-Type": "application/json", api_key: apiKey };
  const request = async (path, options = {}) => {
    const response = await fetchImpl(url(path), { headers, ...options });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  return {
    listConversations: () => request("/conversations"),
    createConversation: () => request("/conversations", { method: "POST", body: "{}" }),
    sendMessage: (conversationId, content) =>
      request(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    listMemory: () => request("/memory"),
    deleteMessage: (conversationId, messageId) =>
      request(`/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" }),
  };
}

/** Normaliza resposta de envio para o texto do assistente. */
export function extractAssistantText(data) {
  if (Array.isArray(data) && data.length) return extractAssistantText(data.at(-1));
  const direct = data?.content ?? data?.text ?? data?.message;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") return direct.content ?? direct.text ?? "";
  return "";
}
