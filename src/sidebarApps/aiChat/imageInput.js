/**
 * Entrada de anexos do Acodex AI (frontend).
 *
 * Permite anexar QUALQUER arquivo à mensagem:
 *  - imagens: reduzidas no app (canvas) para um tamanho compatível com
 *    APIs de visão e convertidas em data URL (formato OpenAI de partes
 *    text/image_url);
 *  - arquivos de texto/código (js, py, md, json, log...): lidos no
 *    aparelho e anexados à mensagem como bloco de código com o nome do
 *    arquivo — o modelo recebe o conteúdo real, não um aviso genérico.
 */

/** Maior dimensão da imagem reduzida antes do envio. */
export const MAX_IMAGE_DIM = 1024;

/** Qualidade JPEG da redução. */
export const IMAGE_QUALITY = 0.85;

/** Tamanho máximo de arquivo de texto aceito como anexo (256 KB). */
export const MAX_TEXT_FILE_BYTES = 256 * 1024;

/** Limite de caracteres do conteúdo anexado (corte seguro p/ prompt). */
export const MAX_TEXT_FILE_CHARS = 60000;

/** Extensões reconhecidas como texto/código (além de MIME text/* e JSON). */
const TEXT_FILE_EXTENSIONS = [
	".js",
	".mjs",
	".cjs",
	".ts",
	".jsx",
	".tsx",
	".json",
	".md",
	".markdown",
	".txt",
	".log",
	".csv",
	".tsv",
	".py",
	".rb",
	".php",
	".java",
	".kt",
	".swift",
	".c",
	".h",
	".cpp",
	".hpp",
	".cs",
	".go",
	".rs",
	".sql",
	".sh",
	".bash",
	".zsh",
	".yml",
	".yaml",
	".toml",
	".ini",
	".conf",
	".env",
	".xml",
	".html",
	".htm",
	".css",
	".scss",
	".less",
	".vue",
	".gradle",
	".properties",
	".bat",
	".ps1",
	".lua",
	".r",
	".dart",
];

/**
 * Verifica se um arquivo pode ser lido como texto/código.
 * @param {File} file arquivo escolhido
 * @returns {boolean}
 */
export function isTextFile(file) {
	const name = String(file?.name || "").toLowerCase();
	const ext = name.slice(name.lastIndexOf("."));
	if (TEXT_FILE_EXTENSIONS.includes(ext)) return true;
	const type = String(file?.type || "");
	return type.startsWith("text/") || type === "application/json";
}

/**
 * Lê um arquivo de texto/código como string (com limite de caracteres).
 * @param {File} file arquivo
 * @returns {Promise<string>} conteúdo do arquivo
 */
export function readTextFile(file) {
	return new Promise((resolve, reject) => {
		if (file.size > MAX_TEXT_FILE_BYTES) {
			reject(
				new Error(
					`Arquivo grande demais (${Math.round(file.size / 1024)} KB). Limite: ${MAX_TEXT_FILE_BYTES / 1024} KB.`,
				),
			);
			return;
		}
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
		reader.onload = () => {
			const text = String(reader.result || "");
			resolve(
				text.length > MAX_TEXT_FILE_CHARS
					? `${text.slice(0, MAX_TEXT_FILE_CHARS)}
… [arquivo cortado em ${MAX_TEXT_FILE_CHARS} caracteres]`
					: text,
			);
		};
		reader.readAsText(file);
	});
}

/**
 * Prompt padrão quando a usuária envia só a imagem, sem texto.
 * Análise avançada de código e contexto visual.
 */
export const DEFAULT_IMAGE_PROMPT =
	"Analise esta imagem em profundidade: identifique qualquer código (linguagem, framework, bibliotecas, versões), aponte erros, bugs e falhas visuais, descreva todo o conteúdo e dê recomendações acionáveis. Se houver código, transcreva-o corrigido.";

/**
 * Monta o conteúdo (formato OpenAI) de uma mensagem de usuário com imagem.
 * @param {string} text texto da mensagem
 * @param {string} dataUrl imagem em data URL
 * @returns {{type: "text", text: string}[] | {type: "image_url", image_url: {url: string}}[]}
 */
export function buildVisionContent(text, dataUrl) {
	return [
		{ type: "text", text: String(text || "") },
		{ type: "image_url", image_url: { url: dataUrl } },
	];
}

/**
 * Reduz e normaliza uma imagem de arquivo para data URL JPEG.
 * @param {File} file arquivo de imagem
 * @param {number} [maxDim] maior dimensão permitida
 * @returns {Promise<string>} data URL JPEG
 */
export async function fileToScaledDataUrl(file, maxDim = MAX_IMAGE_DIM) {
	if (!file?.type?.startsWith("image/")) {
		throw new Error("Arquivo não é uma imagem.");
	}
	const objectUrl = URL.createObjectURL(file);
	try {
		const img = await loadImage(objectUrl);
		const scale = Math.min(
			1,
			maxDim / Math.max(img.naturalWidth, img.naturalHeight),
		);
		const width = Math.max(1, Math.round(img.naturalWidth * scale));
		const height = Math.max(1, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		// fundo branco: JPEG não tem transparência
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);
		ctx.drawImage(img, 0, 0, width, height);
		return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

/** @returns {Promise<HTMLImageElement>} */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
		img.src = src;
	});
}

/**
 * Cria a UI de anexo: botão, input de arquivo oculto (qualquer tipo) e
 * chip de pré-visualização.
 * O anexo pendente tem a forma:
 *  - {kind: "image", dataUrl, name} para imagens (envio de visão)
 *  - {kind: "text", content, name} para arquivos de texto/código
 * @param {{ onChange: () => void, beforePick?: () => void }} callbacks
 */
export function createImageInput({ onChange, beforePick } = {}) {
	/** @type {{kind: string, dataUrl?: string, content?: string, name: string} | null} */
	let pending = null;

	const $chip = <span className="ai-attach-chip" hidden></span>;
	const $fileInput = (
		<input
			type="file"
			className="ai-attach-input"
			aria-hidden="true"
			tabindex="-1"
			onchange={onFilePicked}
		/>
	);
	const $btn = (
		<button
			type="button"
			className="ai-send ai-attach"
			aria-label="Anexar arquivo"
			title="Anexar imagem ou arquivo de texto/código"
			onclick={async () => {
				await beforePick?.();
				$fileInput.click();
			}}
		>
			<span className="icon image_alt" />
		</button>
	);

	async function onFilePicked() {
		const file = $fileInput.files?.[0];
		$fileInput.value = "";
		if (!file) return;
		try {
			if (file.type.startsWith("image/")) {
				const dataUrl = await fileToScaledDataUrl(file);
				pending = { kind: "image", dataUrl, name: file.name || "imagem" };
			} else if (isTextFile(file)) {
				const content = await readTextFile(file);
				pending = { kind: "text", content, name: file.name || "arquivo" };
			} else {
				throw new Error(
					"Tipo de arquivo não suportado. Anexe uma imagem ou um arquivo de texto/código.",
				);
			}
		} catch (error) {
			pending = null;
			alert(String(error?.message || error));
		}
		renderChip();
		onChange?.();
	}

	function renderChip() {
		if (!pending) {
			$chip.hidden = true;
			$chip.replaceChildren();
			return;
		}
		const $name = <span className="ai-attach-name">{pending.name}</span>;
		const $remove = (
			<button
				type="button"
				className="ai-attach-remove"
				aria-label="Remover anexo"
				onclick={() => clear()}
			>
				<span className="icon clearclose" />
			</button>
		);
		let $visual;
		if (pending.kind === "image") {
			$visual = (
				<img
					src={pending.dataUrl}
					alt={pending.name}
					className="ai-attach-thumb"
				/>
			);
		} else {
			$visual = <span className="icon description ai-attach-thumb" />;
		}
		$chip.hidden = false;
		$chip.replaceChildren($visual, $name, $remove);
	}

	function clear() {
		pending = null;
		renderChip();
		onChange?.();
	}

	return {
		$btn,
		$chip,
		$fileInput,
		/** Anexo pendente ({kind: "image"|"text", name, dataUrl?|content?}) ou null. */
		get pending() {
			return pending;
		},
		clear,
	};
}
