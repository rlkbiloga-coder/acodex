/**
 * AcodeX IA Conexões — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

import select from "dialogs/select";
import { launchShellInTerminal } from "lib/acodexAI";

/**
 * AcodeX IA Conexões — conecta o assistente a serviços oficiais.
 *
 * Cada conector leva o usuário até o SITE OFICIAL do serviço para
 * autorizar (OAuth do GitHub/Google, QR do WhatsApp) e guarda o token
 * CRIPTOGRAFADO no aparelho do próprio usuário. O repo público não
 * contém nenhum segredo: cada um conecta a própria conta.
 *
 * Para adicionar um conector novo: crie a função correspondente no
 * helper `acodex-connect` (abaixo) e registre aqui em CONNECTORS.
 */

/** @type {{id: string, name: string, cmd: string, description: string, note: string}[]} */
export const CONNECTORS = [
	{
		id: "github",
		name: "GitHub",
		cmd: "github",
		description:
			"Autorização no site oficial do GitHub (github.com/login/device) — via GitHub CLI ou OAuth de dispositivo",
		note: "token fica salvo no aparelho, nada vai para o repo",
	},
	{
		id: "gmail",
		name: "Gmail",
		cmd: "gmail",
		description:
			"OAuth do Google no site oficial (accounts.google.com) com client próprio gratuito do Google Cloud",
		note: "token criptografado (AES-256) no aparelho",
	},
	{
		id: "whatsapp",
		name: "WhatsApp",
		cmd: "whatsapp",
		description:
			"Pareamento por QR code com o OpenClaw (mesmo fluxo do WhatsApp Web), sem API paga",
		note: "requer OpenClaw (instalação automática)",
	},
];

/**
 * Comando shell que garante o helper `acodex-connect` instalado no sandbox.
 * O helper é um único script POSIX, sem dependências além de curl/openssl/node.
 * Nenhum segredo é embutido: credenciais ficam criptografadas no aparelho.
 */
export const CONNECT_HELPER_INSTALL = `command -v acodex-connect >/dev/null 2>&1 || { cat > /usr/local/bin/acodex-connect <<'ACODEX_CONNECT_EOF'
#!/bin/sh
# acodex-connect — Copyright (c) 2026 mlk010173 (AcodeX IA License).
# Conecta o AcodeX IA a servicos oficiais (GitHub, Gmail, WhatsApp).
# Repo publico: ZERO segredos embutidos. Cada token fica CRIPTOGRAFADO
# (AES-256 via openssl) no APARELHO do proprio usuario.
# Uso: acodex-connect menu|github|gmail|whatsapp|status

DIR="\$HOME/.acodex"

hdr() { printf '\\n\\033[1m== %s ==\\033[0m\\n' "\$1"; }

ask_pass() {
  printf "senha para criptografar o token no aparelho (nunca sai daqui): "
  stty -echo 2>/dev/null; read P; stty echo 2>/dev/null; printf '\\n'
  printf '%s' "\$P"
}

save_enc() {
  mkdir -p "\$DIR" && chmod 700 "\$DIR"
  printf '%s' "\$2" | ACX_ENC_PASS="\$3" openssl enc -aes-256-cbc -pbkdf2 -salt -out "\$DIR/\$1" -pass env:ACX_ENC_PASS 2>/dev/null \\
    && chmod 600 "\$DIR/\$1" && echo "salvo criptografado em \$DIR/\$1"
}

connect_github() {
  hdr "GitHub — autorizacao no site oficial"
  command -v gh >/dev/null 2>&1 || apk add -q github-cli >/dev/null 2>&1
  if command -v gh >/dev/null 2>&1; then
    echo "O GitHub CLI mostra um CODIGO aqui e abre github.com/login/device:"
    echo "1. veja o codigo no terminal   2. digite no site   3. autorize"
    gh auth login -h github.com -p https -w && gh auth status
    return 0
  fi
  echo "GitHub CLI indisponivel — fluxo manual de OAuth de dispositivo:"
  echo "crie um OAuth App gratuito em github.com/settings/developers"
  echo "(marque 'Enable Device Flow') e informe o Client ID abaixo."
  printf "Client ID: "
  read CID
  [ -z "\$CID" ] && { echo "cancelado"; return 1; }
  RESP=\$(curl -s -X POST https://github.com/login/device/code -H "Accept: application/json" -d "client_id=\$CID" -d "scope=repo read:org")
  DCODE=\$(printf '%s' "\$RESP" | sed -n 's/.*"device_code"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
  UCODE=\$(printf '%s' "\$RESP" | sed -n 's/.*"user_code"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
  URI=\$(printf '%s' "\$RESP" | sed -n 's/.*"verification_uri"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
  [ -z "\$DCODE" ] && { echo "nao recebi device code — confira o Client ID"; return 1; }
  printf '\\n1. Abra %s\\n2. Digite o codigo: \\033[1m%s\\033[0m\\n3. Autorize no GitHub\\n\\n' "\$URI" "\$UCODE"
  echo "aguardando autorizacao..."
  T=""
  while :; do
    sleep 5
    T=\$(curl -s -X POST https://github.com/login/oauth/access_token -H "Accept: application/json" -d "client_id=\$CID" -d "device_code=\$DCODE" -d "grant_type=urn:ietf:params:oauth:grant-type:device_code")
    ERR=\$(printf '%s' "\$T" | sed -n 's/.*"error"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
    if [ "\$ERR" = "authorization_pending" ] || [ "\$ERR" = "slow_down" ]; then continue; fi
    break
  done
  TOKEN=\$(printf '%s' "\$T" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
  [ -z "\$TOKEN" ] && { echo "falha: \$T"; return 1; }
  save_enc gh.enc "\$TOKEN" "\$(ask_pass)"
}

connect_gmail() {
  hdr "Gmail — OAuth do Google (client proprio, gratuito)"
  command -v node >/dev/null 2>&1 || { echo "requer node no sandbox (plugin node do AcodeX)"; return 1; }
  echo "Passo unico (uma vez): crie um OAuth Client ID gratuito:"
  echo "  1. console.cloud.google.com/apis/library/gmail.googleapis.com -> ativar a Gmail API"
  echo "  2. console.cloud.google.com/apis/credentials -> criar credencial -> OAuth Client ID"
  echo "  3. Tipo: 'Desktop app' -> copie Client ID e Client Secret"
  printf "Client ID: "
  read GID
  printf "Client Secret: "
  read GSEC
  { [ -z "\$GID" ] || [ -z "\$GSEC" ]; } && { echo "cancelado"; return 1; }
  export GID GSEC
  echo '\\nAbra o link abaixo no navegador do aparelho e autorize com sua conta Google:'
  node -e 'const c=encodeURIComponent;const cb="http://127.0.0.1:49152/oauth2callback";const sc="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";console.log("https://accounts.google.com/o/oauth2/v2/auth?client_id="+process.env.GID+"&redirect_uri="+c(cb)+"&response_type=code&scope="+c(sc)+"&access_type=offline&prompt=consent");'
  echo '\\naguardando a autorizacao voltar para o terminal...'
  JSON=\$(node -e 'const http=require("http"),https=require("https");const srv=http.createServer((q,s)=>{const code=new URL(q.url,"http://x").searchParams.get("code");if(!code){s.writeHead(400);s.end("sem codigo");return;}const body="code="+encodeURIComponent(code)+"&client_id="+process.env.GID+"&client_secret="+process.env.GSEC+"&redirect_uri="+encodeURIComponent("http://127.0.0.1:49152/oauth2callback")+"&grant_type=authorization_code";const r=https.request("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(body)}},rr=>{let d="";rr.on("data",x=>d+=x);rr.on("end",()=>{s.writeHead(200,{"Content-Type":"text/plain"});s.end("Autorizado! Volte ao terminal do AcodeX.");console.log(d);srv.close();});});r.on("error",()=>{s.writeHead(500);s.end("erro");srv.close();});r.end(body);});srv.listen(49152,"127.0.0.1");setTimeout(()=>process.exit(1),600000);')
  REFRESH=\$(printf '%s' "\$JSON" | sed -n 's/.*"refresh_token"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
  [ -z "\$REFRESH" ] && { echo "falha ao obter refresh_token: \$(printf '%s' "\$JSON" | sed -E 's/"(access_token|refresh_token|id_token)"[[:space:]]*:[[:space:]]*"[^"]*"/"\\1":"[REDACTED]"/g')"; return 1; }
  save_enc gmail.enc "\$REFRESH" "\$(ask_pass)"
}

connect_whatsapp() {
  hdr "WhatsApp — pareamento por QR (via OpenClaw)"
  command -v openclaw >/dev/null 2>&1 || npm install -g openclaw@latest >/dev/null 2>&1
  command -v openclaw >/dev/null 2>&1 || { echo "nao consegui instalar o openclaw"; return 1; }
  [ -d "\$HOME/.openclaw" ] || { echo "primeira vez: onboarding do OpenClaw"; openclaw onboard --install-daemon || return 1; }
  echo "Escolha WhatsApp no menu e escaneie o QR pelo app do celular:"
  echo "WhatsApp > Aparelhos conectados > Conectar aparelho"
  openclaw channels add
  openclaw channels login
  openclaw channels status
}

status() {
  hdr "Estado das conexoes"
  if command -v gh >/dev/null 2>&1; then gh auth status 2>&1 | head -4; else echo "github: CLI nao instalado (acodex-connect github instala)"; fi
  [ -f "\$DIR/gh.enc" ] && echo "github (manual): token salvo criptografado"
  if [ -f "\$DIR/gmail.enc" ]; then echo "gmail: conectado (token criptografado no aparelho)"; else echo "gmail: nao conectado (acodex-connect gmail)"; fi
  if command -v openclaw >/dev/null 2>&1; then openclaw channels status 2>&1 | head -8; else echo "whatsapp: openclaw nao instalado (acodex-connect whatsapp instala)"; fi
}

menu() {
  while :; do
    printf '\\n\\033[1mAcodeX IA Conexoes\\033[0m\\n'
    printf '1. GitHub   (autorizar no site oficial)\\n'
    printf '2. Gmail    (OAuth do Google)\\n'
    printf '3. WhatsApp (pareamento por QR)\\n'
    printf '4. Estado das conexoes\\n'
    printf '0. Sair\\n'
    printf 'opcao: '
    read OP
    case "\$OP" in
      1) connect_github ;;
      2) connect_gmail ;;
      3) connect_whatsapp ;;
      4) status ;;
      0) break ;;
      *) echo 'opcao invalida' ;;
    esac
  done
}

case "\$1" in
  github) connect_github ;;
  gmail) connect_gmail ;;
  whatsapp) connect_whatsapp ;;
  status) status ;;
  menu|'') menu ;;
  *) echo "uso: acodex-connect menu|github|gmail|whatsapp|status" ;;
esac
ACODEX_CONNECT_EOF
chmod 755 /usr/local/bin/acodex-connect; }`;

/**
 * Monta o comando shell completo para um conector (instala helper e conecta).
 * @param {object} connector Entrada de CONNECTORS
 * @returns {string}
 */
export function buildConnectCommand(connector) {
	return `${CONNECT_HELPER_INSTALL}; acodex-connect ${connector.cmd}`;
}

/**
 * Abre o seletor de conexões e conecta o serviço escolhido num terminal.
 * @returns {Promise<void>}
 */
export default async function acodexConnect() {
	const entries = [
		...CONNECTORS,
		{
			id: "status",
			name: "Estado das conexões",
			cmd: "status",
			description: "Mostra o que já está conectado (GitHub, Gmail, WhatsApp)",
			note: "",
		},
	];
	const choice = await select(
		"AcodeX IA: conectar serviços (autorização no site oficial)",
		entries.map((entry) => ({
			value: entry.name,
			text: entry.name,
			subText: `${entry.description}${entry.note ? ` — ${entry.note}` : ""}`,
		})),
		{ hideOnSelect: true },
	);
	const connector = entries.find(({ name }) => name === choice);
	if (!connector) return;
	await launchShellInTerminal(
		`Conexão: ${connector.name}`,
		buildConnectCommand(connector),
	);
}
