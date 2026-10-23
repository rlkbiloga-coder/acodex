import ReasoningLog from "./ReasoningLog.jsx";

/** Mensagem do chat (usuário ou assistente) com log colapsável. */
export default function Message({ role, content, steps = [] }) {
  const isUser = role === "user";
  return (
    <article className={`message ${isUser ? "user" : "assistant"}`}>
      {!isUser && <ReasoningLog steps={steps} />}
      <div className="bubble">{content}</div>
    </article>
  );
}
