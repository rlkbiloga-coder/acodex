import { useState } from "react";

/** Composer inferior: anexo, texto e envio. */
export default function Composer({ onSend, disabled = false }) {
  const [value, setValue] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };
  return (
    <form className="composer" onSubmit={submit}>
      <button type="button" className="attach" aria-label="Anexar arquivo">📎</button>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Escreva sua mensagem…"
        aria-label="Mensagem"
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !value.trim()} aria-label="Enviar">
        ➤
      </button>
    </form>
  );
}
