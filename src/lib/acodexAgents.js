/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

/**
 * AcodeX IA — REGISTRO ÚNICO DE AGENTES
 *
 * Este é o único ponto de cadastro de agentes do AcodeX IA.
 * Para adicionar um novo agente (de qualquer origem), basta criar
 * uma nova entrada neste objeto. Nada mais precisa ser alterado:
 * o seletor (comando "acodex-ai") lê tudo daqui automaticamente.
 *
 * Campos de cada entrada:
 *  - name:        nome exibido no seletor
 *  - kind:        "cli" (roda no sandbox) | "api" (fala com um serviço externo)
 *  - tier:        "free" (open-source/grátis) | "freemium" (tem plano grátis)
 *                 | "paid" (pago)
 *  - status:      "ativo" (pronto) | "provisorio" (requer chave/assinatura
 *                 do próprio usuário — pode deixar pra depois)
 *  - bin:         comando que inicia o agente (kind "cli")
 *  - install:     comando shell que instala o agente no sandbox
 *  - script:      nome do helper instalado no sandbox (kind "api")
 *  - description: texto curto exibido no seletor
 *  - note:        aviso curto sobre chave/requisito, se houver
 */

/** @type {Record<string, object>} */
export const AGENT_REGISTRY = {
	"base44-superagent": {
		name: "Base44 Superagent",
		kind: "api",
		tier: "freemium",
		status: "ativo",
		script: "acodex-b44",
		defaultAgentId: "6a9d897805e878cd9cbe4209",
		defaultAgentName: "Solas (Martins Nexos)",
		defaultAgentUrl:
			"https://app.base44.com/superagent/6a9d897805e878cd9cbe4209",
		description:
			"Superagent da Base44 (sandbox, git, navegador, automações) — padrão: Solas, agente do Martins Nexos",
		note: "cada usuário configura o PRÓPRIO agente e créditos — nada embutido no app. O id padrão (público) já vem preenchido; a chave de API NUNCA vai no repo",
	},
	"gemini-cli": {
		name: "Gemini CLI",
		kind: "cli",
		tier: "freemium",
		status: "ativo",
		bin: "gemini",
		install: "npm install -g @google/gemini-cli",
		description: "Google AI coding agent (tem tier grátis)",
	},
	opencode: {
		name: "OpenCode",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "opencode",
		install: "npm install -g opencode-ai",
		description: "Coding agent open-source (chave própria)",
	},
	crush: {
		name: "Crush",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "crush",
		install: "npm install -g @charmbracelet/crush",
		description: "Coding agent open-source da Charm",
	},
	aider: {
		name: "Aider",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "aider",
		install:
			"apk add -q python3 py3-pip >/dev/null 2>&1; python3 -m pip install --break-system-packages aider-chat",
		description: "AI pair programming open-source (Python)",
	},
	ollama: {
		name: "Ollama",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "ollama",
		install: "curl -fsSL https://ollama.com/install.sh | sh",
		description: "Modelos de IA locais, open-source e offline",
	},
	"qwen-code": {
		name: "Qwen Code",
		kind: "cli",
		tier: "freemium",
		status: "ativo",
		bin: "qwen",
		install: "npm install -g @qwen-code/qwen-code@latest",
		description: "Agente open-source da Alibaba (tier grátis generoso)",
	},
	goose: {
		name: "Goose",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "goose",
		install:
			"curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash",
		description: "Agente open-source da Block",
	},
	openhands: {
		name: "OpenHands",
		kind: "cli",
		tier: "free",
		status: "ativo",
		bin: "openhands",
		install:
			"apk add -q python3 py3-pip >/dev/null 2>&1; python3 -m pip install --break-system-packages openhands-ai",
		description: "Agente autônomo open-source completo (Python)",
	},
	amp: {
		name: "Amp",
		kind: "cli",
		tier: "freemium",
		status: "ativo",
		bin: "amp",
		install: "npm install -g @sourcegraph/amp@latest",
		description: "Agente da Sourcegraph (tem tier grátis)",
	},
	"claude-code": {
		name: "Claude Code",
		kind: "cli",
		tier: "paid",
		status: "provisorio",
		bin: "claude",
		install: "npm install -g @anthropic-ai/claude-code",
		description: "Anthropic coding agent (assinatura ou API paga)",
		note: "pago — funciona quando você tiver a chave/conta",
	},
	codex: {
		name: "OpenAI Codex",
		kind: "cli",
		tier: "paid",
		status: "provisorio",
		bin: "codex",
		install: "npm install -g @openai/codex",
		description: "OpenAI coding agent (plano pago)",
		note: "pago — funciona quando você tiver a chave/conta",
	},
};

/** Marca exibida no seletor para cada tier. */
export const TIER_LABEL = {
	free: "open-source/grátis",
	freemium: "tem tier grátis",
	paid: "pago (provisório)",
};

/**
 * Instala o helper do agente de API no sandbox do terminal.
 * Discreto: um único script, sem alterar nada mais no sistema.
 * @param {object} agent Entrada do registro com kind "api"
 * @returns {string} Comando shell que garante o helper instalado
 */
export function buildApiHelperInstall(agent) {
	return `command -v ${agent.script} >/dev/null 2>&1 || { cat > /usr/local/bin/${agent.script} <<'ACODEX_B44_EOF'
#!/bin/sh
# acodex-b44 — conversa com um Superagent Base44 direto do terminal do AcodeX.
# Repo publico: ZERO segredos aqui dentro. Credenciais ficam
# CRIPTOGRAFADAS (AES-256) no aparelho de cada usuario, com senha pessoal.
# Uso:
#   acodex-b44 --setup       grava suas credenciais criptografadas
#   acodex-b44 "mensagem"    conversa com o SEU agente Base44
BASE="\${ACODEX_BASE44_URL:-https://app.base44.com/api/agents}"
STORE="$HOME/.acodex/b44.enc"
CONVFILE="$HOME/.acodex/b44.conv"

setup() {
  command -v openssl >/dev/null 2>&1 || { echo "acodex-b44: openssl ausente no sandbox"; exit 1; }
  mkdir -p "$HOME/.acodex" && chmod 700 "$HOME/.acodex"
  DEFAULT_ID="\${ACODEX_DEFAULT_B44_ID:-${agent.defaultAgentId}}"
  printf "id do SEU agente Base44 [Enter = Solas (Martins Nexos) 6a9d897805e878cd9cbe4209]: "
  read AGENT
  [ -z "$AGENT" ] && AGENT="$DEFAULT_ID"
  printf "chave de API do agente: "
  stty -echo 2>/dev/null; read KEY; stty echo 2>/dev/null; printf "\\n"
  printf "senha p/ criptografar localmente (sua, nunca sai daqui): "
  stty -echo 2>/dev/null; read PASS; stty echo 2>/dev/null; printf "\\n"
  printf "%s\\n%s\\n" "$AGENT" "$KEY" | openssl enc -aes-256-cbc -pbkdf2 -salt -out "$STORE" -pass pass:"$PASS" 2>/dev/null \
    && chmod 600 "$STORE" \
    && echo "acodex-b44: ok, gravado CRIPTOGRAFADO em $STORE"
}

[ "$1" = "--setup" ] && { setup; exit 0; }

AGENT=""; KEY=""
if [ -f "$STORE" ]; then
  PASS="\${ACODEX_B44_PASS:-}"
  if [ -z "$PASS" ]; then
    printf "senha local: "
    stty -echo 2>/dev/null; read PASS; stty echo 2>/dev/null; printf "\\n"
  fi
  PLAIN=$(openssl enc -aes-256-cbc -pbkdf2 -d -in "$STORE" -pass pass:"$PASS" 2>/dev/null)
  if [ $? -ne 0 ] || [ -z "$PLAIN" ]; then
    echo "acodex-b44: senha incorreta (ou arquivo corrompido)"
    exit 1
  fi
  AGENT=$(echo "$PLAIN" | sed -n 1p)
  KEY=$(echo "$PLAIN" | sed -n 2p)
else
  AGENT="\${ACODEX_BASE44_AGENT:-${agent.defaultAgentId}}"
  KEY="\${ACODEX_BASE44_KEY:-}"
fi

if [ -z "$AGENT" ] || [ -z "$KEY" ]; then
  echo "acodex-b44: cada um conversa com o SEU proprio agente Base44 (creditos proprios)."
  echo "  1. acodex-b44 --setup     (grava id+chave criptografados NA SUA maquina)"
  echo "  2. acodex-b44 \"oi\"        (conversa)"
  echo "  alternativa: export ACODEX_BASE44_AGENT=... e ACODEX_BASE44_KEY=..."
  exit 1
fi

MSG="$1"
[ -z "$MSG" ] && { echo "uso: acodex-b44 \"mensagem\" | acodex-b44 --setup"; exit 1; }

CONV="\${ACODEX_BASE44_CONV:-}"
[ -z "$CONV" ] && [ -f "$CONVFILE" ] && CONV=$(cat "$CONVFILE" 2>/dev/null)
if [ -z "$CONV" ]; then
  CONV=$(curl -s -X POST "$BASE/$AGENT/conversations" -H "api_key: $KEY" -H "Content-Type: application/json" -d '{"title":"AcodeX"}' | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' | head -n1)
  [ -n "$CONV" ] && echo "$CONV" > "$CONVFILE" 2>/dev/null
fi
[ -z "$CONV" ] && { echo "acodex-b44: nao consegui criar/obter conversa — confira suas credenciais"; exit 1; }

curl -s -X POST "$BASE/$AGENT/conversations/$CONV/messages" -H "api_key: $KEY" -H "Content-Type: application/json" -d "{\\"message\\":\\"$MSG\\"}"
echo ""
ACODEX_B44_EOF
chmod +x /usr/local/bin/${agent.script}; }`;
}
