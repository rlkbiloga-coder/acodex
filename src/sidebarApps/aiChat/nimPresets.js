/**
 * Presets do NVIDIA NIM (build.nvidia.com) para o seletor de modelos.
 * Dados puros, sem JSX, para facilitar testes unitários.
 */

/** Endpoint NVIDIA NIM, OpenAI-compatível e gratuito. */
export const NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** Seleção de modelos fortes do NIM (gratuitos, ~40 req/min por conta). */
export const NVIDIA_NIM_MODELS = [
	{
		id: "moonshotai/kimi-k3",
		label: "Kimi K3 (NIM)",
		badges: ["NIM grátis", "híbrido MoE"],
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b",
		label: "Nemotron 3 Ultra 550B (NIM)",
		badges: ["NIM grátis", "agente"],
	},
	{
		id: "nvidia/nemotron-3.5-lightning-30b-a3b",
		label: "Nemotron 3.5 Lightning 30B (NIM)",
		badges: ["NIM grátis", "rápido"],
	},
	{
		id: "deepseek-ai/deepseek-v4.1-flash",
		label: "DeepSeek V4.1 Flash (NIM)",
		badges: ["NIM grátis", "código"],
	},
	{
		id: "meta/llama-3.2-90b-vision-instruct",
		label: "Llama 3.2 90B Vision (NIM)",
		badges: ["NIM grátis", "visão"],
	},
	{
		id: "google/gemma-4-31b-it",
		label: "Gemma 4 31B (NIM)",
		badges: ["NIM grátis"],
	},
].map((model) => ({ ...model, baseUrl: NVIDIA_NIM_BASE_URL }));
