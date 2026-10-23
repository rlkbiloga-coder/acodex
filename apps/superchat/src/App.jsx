import { Navigate, Route, Routes } from "react-router-dom";
import ChatView from "./routes/ChatView.jsx";
import ConversationsView from "./routes/ConversationsView.jsx";
import MemoryView from "./routes/MemoryView.jsx";
import Sidebar from "./components/Sidebar.jsx";

/** Rotas espelham o chat Base44: chat (padrão), conversas e memória. */
export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<ChatView />} />
          <Route path="/conversations" element={<ConversationsView />} />
          <Route path="/memory" element={<MemoryView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
