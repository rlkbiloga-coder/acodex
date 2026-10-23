import { useState } from "react";

/** Memória do agente + configuração local do clone (agentId/apiKey). */
export default function MemoryView() {
  const [config, setConfig] = useState(() =>
    JSON.parse(localStorage.getItem("superchat") || "{}"),
  );
  const save = (event) => {
    event.preventDefault();
    localStorage.setItem("superchat", JSON.stringify(config));
    event.currentTarget.querySelector("button").textContent = "Salvo ✓";
  };
  return (
    <div>
      <header className="chat-header">
        <h1>Memória</h1>
        <p>GET /api/agents/&lt;id&gt;/memory + configuração local</p>
      </header>
      <form onSubmit={save} className="config-form">
        <label>
          agentId
          <input
            value={config.agentId || ""}
            onChange={(event) => setConfig({ ...config, agentId: event.target.value })}
            placeholder="ex: 6ad30b448acb1d215b14de8f"
          />
        </label>
        <label>
          apiKey (fica só neste navegador)
          <input
            type="password"
            value={config.apiKey || ""}
            onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
            placeholder="Developer → API key"
          />
        </label>
        <button type="submit">Salvar</button>
      </form>
    </div>
  );
}
