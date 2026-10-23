import { useCallback, useEffect, useState } from "react";
import Composer from "../components/Composer.jsx";
import Message from "../components/Message.jsx";
import { createAgentClient, extractAssistantText } from "../api/agentApi.js";

/** Conversa padrão do agente: espelha o chat principal do Superagent. */
export default function ChatView() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const config = JSON.parse(localStorage.getItem("superchat") || "{}");

  const send = useCallback(
    async (text) => {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setBusy(true);
      setError("");
      try {
        if (!config.agentId || !config.apiKey) {
          throw new Error("Configure agentId e apiKey em /memory");
        }
        const client = createAgentClient(config);
        const conversations = await client.listConversations();
        const conversationId =
          Array.isArray(conversations) ? conversations[0]?.id : conversations?.id;
        const response = await client.sendMessage(conversationId, text);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: extractAssistantText(response) },
        ]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setBusy(false);
      }
    },
    [config],
  );

  useEffect(() => {
    document.title = "Superchat — clone Base44";
  }, []);

  return (
    <div className="chat-view">
      <header className="chat-header">
        <h1>Chat</h1>
        <p>Conversa padrão com o Superagent</p>
      </header>
      <div className="messages" aria-live="polite">
        {messages.length === 0 && <p className="empty">Envie a primeira mensagem 👋</p>}
        {messages.map((message, index) => (
          <Message key={index} {...message} />
        ))}
        {busy && <p className="typing">pensando…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <Composer onSend={send} disabled={busy} />
    </div>
  );
}
