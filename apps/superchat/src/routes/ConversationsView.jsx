import { useEffect, useState } from "react";
import { createAgentClient } from "../api/agentApi.js";

/** Lista de conversas do agente (GET /conversations). */
export default function ConversationsView() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const config = JSON.parse(localStorage.getItem("superchat") || "{}");
    if (!config.agentId || !config.apiKey) {
      setError("Configure agentId e apiKey em /memory");
      return;
    }
    createAgentClient(config)
      .listConversations()
      .then((data) => setItems(Array.isArray(data) ? data : [data]))
      .catch((requestError) => setError(requestError.message));
  }, []);
  return (
    <div>
      <header className="chat-header">
        <h1>Conversas</h1>
        <p>GET /api/agents/&lt;id&gt;/conversations</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="conversation-list">
        {items.map((item) => (
          <li key={item.id}>{item.title || item.id}</li>
        ))}
      </ul>
    </div>
  );
}
