/**
 * Presets de modelos open source em provedores com free tier
 * (OpenRouter ":free" e Groq). Requerem API key própria, gratuita.
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
