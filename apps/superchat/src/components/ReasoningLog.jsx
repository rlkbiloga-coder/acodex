import { useState } from "react";

/** Log de raciocínio colapsável (passos/tools da resposta), estilo Base44. */
export default function ReasoningLog({ steps = [] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <section className="reasoning" aria-label="Log de raciocínio">
      <button type="button" className="reasoning-toggle" onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} Raciocínio e ferramentas ({steps.length})
      </button>
      {open && (
        <ol className="reasoning-list">
          {steps.map((step, index) => (
            <li key={step.id ?? index}>
              <span className="step-name">{step.name}</span>
              <pre className="step-output">{step.output}</pre>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
