import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { extractAssistantText } from "./api/agentApi.js";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

describe("superchat clone", () => {
  it("renderiza as rotas do sidebar", () => {
    renderApp();
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0);
    expect(screen.getByText("Conversas")).toBeTruthy();
    expect(screen.getByText("Memória")).toBeTruthy();
  });

  it("chat: pede config quando envia sem apiKey", async () => {
    localStorage.clear();
    renderApp();
    const input = screen.getByLabelText("Mensagem");
    fireEvent.change(input, { target: { value: "oi" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Configure"),
    );
  });

  it("memória: salva agentId localmente", async () => {
    localStorage.clear();
    renderApp();
    fireEvent.click(screen.getByText("Memória"));
    const input = screen.getAllByRole("textbox")[0];
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.submit(input.closest("form"));
    expect(JSON.parse(localStorage.getItem("superchat")).agentId).toBe("abc123");
  });

  it("extractAssistantText normaliza formatos", () => {
    expect(extractAssistantText({ content: "oi" })).toBe("oi");
    expect(extractAssistantText({ message: { content: "x" } })).toBe("x");
    expect(extractAssistantText([{ content: "a" }, { content: "b" }])).toBe("b");
  });
});
