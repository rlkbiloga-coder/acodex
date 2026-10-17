/**
 * Presets de modelos open source em provedores com free tier
 * (OpenRouter ":free", Groq e OpenCode Zen). Requerem API key
 * própria, gratuita.
 */

/** @typedef {{id: string, label: string, badges: string[]}} PresetModel */

/**
 * OpenRouter mantém um catálogo de modelos open com sufixo ":free"
 * (rate-limit diário, sem custo). Keys gratuitas em openrouter.ai.
 * @type {PresetModel[]}
 */
export const OPENROUTER_FREE_MODELS = [
	{
		id: "meta-llama/llama-4-scout:free",
		label: "Llama 4 Scout free (OpenRouter)",
		badges: ["OpenRouter", "free"],
	},
	{
		id: "deepseek/deepseek-v4.1:free",
		label: "DeepSeek V4.1 free (OpenRouter)",
		badges: ["OpenRouter", "free", "código"],
	},
	{
		id: "qwen/qwen3-coder:free",
		label: "Qwen3 Coder free (OpenRouter)",
		badges: ["OpenRouter", "free", "código"],
	},
	{
		id: "mistralai/mistral-small-3.2:free",
		label: "Mistral Small 3.2 free (OpenRouter)",
		badges: ["OpenRouter", "free"],
	},
	{
		id: "google/gemma-4-31b-it:free",
		label: "Gemma 4 31B free (OpenRouter)",
		badges: ["OpenRouter", "free"],
	},
	{
		id: "moonshotai/kimi-k3:free",
		label: "Kimi K3 free (OpenRouter)",
		badges: ["OpenRouter", "free"],
	},
];

/**
 * Groq hospeda modelos open com latência mínima. Keys gratuitas em
 * console.groq.com (rate-limit generoso).
 * @type {PresetModel[]}
 */
export const GROQ_MODELS = [
	{
		id: "llama-3.3-70b-versatile",
		label: "Llama 3.3 70B (Groq)",
		badges: ["Groq", "free", "rápido"],
	},
	{
		id: "openai/gpt-oss-20b",
		label: "GPT-OSS 20B (Groq)",
		badges: ["Groq", "free", "rápido"],
	},
	{
		id: "qwen/qwen3-32b",
		label: "Qwen3 32B (Groq)",
		badges: ["Groq", "free"],
	},
	{
		id: "deepseek-r1-distill-llama-70b",
		label: "DeepSeek R1 Distill 70B (Groq)",
		badges: ["Groq", "free", "raciocínio"],
	},
];

/**
 * Endpoint OpenAI-compatible do OpenCode Zen. Os modelos "free" do Zen
 * não custam nada; a key sai do login em opencode.ai/auth (console).
 */
export const OPENCODE_ZEN_BASE_URL = "https://opencode.ai/inference/openai/v1";

/**
 * Modelos free do OpenCode Zen (testados pelo time do OpenCode).
 * Key gratuita: faça login em opencode.ai/auth, copie a API key do
 * console e cole nas configurações do AcodeX IA. Mesma key usada pelo
 * CLI `opencode`.
 * @type {PresetModel[]}
 */
export const OPENCODE_ZEN_FREE_MODELS = [
	{
		id: "nemotron-3.5-lightning-free",
		label: "Nemotron 3.5 Lightning free (Zen)",
		badges: ["Zen free", "código"],
	},
	{
		id: "nemotron-3-ultra-free",
		label: "Nemotron 3 Ultra free (Zen)",
		badges: ["Zen free", "agente"],
	},
	{
		id: "nemotron-3.5-super-vl-free",
		label: "Nemotron 3.5 Super VL free (Zen)",
		badges: ["Zen free", "visão"],
	},
	{
		id: "deepseek-v4.1-flash-free",
		label: "DeepSeek V4.1 Flash free (Zen)",
		badges: ["Zen free", "código"],
	},
	{
		id: "big-pickle",
		label: "Big Pickle free (Zen)",
		badges: ["Zen free", "código"],
	},
	{
		id: "mimo-v2.6-flash-free",
		label: "MiMo V2.6 Flash free (Zen)",
		badges: ["Zen free", "rápido"],
	},
	{
		id: "mimo-v2.5-free",
		label: "MiMo V2.5 free (Zen)",
		badges: ["Zen free"],
	},
	{
		id: "space-bunny-free",
		label: "Space Bunny free (Zen)",
		badges: ["Zen free"],
	},
	{
		id: "cat-jam-free",
		label: "Cat Jam free (Zen)",
		badges: ["Zen free"],
	},
	{
		id: "exo-free",
		label: "Exo free (Zen)",
		badges: ["Zen free"],
	},
	{
		id: "longcat-2.5-preview-free",
		label: "LongCat 2.5 Preview free (Zen)",
		badges: ["Zen free"],
	},
];
