import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Chat", icon: "💬", end: true },
  { to: "/conversations", label: "Conversas", icon: "🗂" },
  { to: "/memory", label: "Memória", icon: "🧠" },
];

/** Sidebar de navegação estilo Base44. */
export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Navegação">
      <div className="brand">
        <div className="avatar" aria-hidden="true">S</div>
        <div>
          <strong>Superagent</strong>
          <small>Base44 clone</small>
        </div>
      </div>
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end}>
              <span aria-hidden="true">{link.icon}</span> {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="foot">API: /api/agents/&lt;id&gt;</p>
    </nav>
  );
}
