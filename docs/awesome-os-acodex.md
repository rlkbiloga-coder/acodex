# Catálogo Awesome Open Source AI — curadoria para o Acodex

Curadoria a partir de awesomeosai.com (repo: alvinunreal/awesome-opensource-ai, 1116 projetos).
Filtro: o que faz sentido para o AcodeX — editor Android com IA. Dividido por uso.

## Como usar agora no Acodex IA
1. Modelos free: seletor > grupo "NVIDIA NIM" (key gratuita em build.nvidia.com).
2. Servidor local: rode Ollama/llama.cpp no PC e aponte a URL base nas configurações.
3. Groq/OpenRouter: crie key grátis (console.groq.com / openrouter.ai) e cole nas configurações; modelos :free do OpenRouter são gratuitos.
4. MCP: tela Servidores MCP nas configurações aceita qualquer servidor MCP open source.


## Modelos open (via NIM/endpoint compatível OpenAI)

1. [Llama 4](https://github.com/meta-llama/llama-models) — Família Llama da Meta, pesos abertos (90B Vision já no seletor)
2. [Qwen 3](https://github.com/QwenLM/Qwen3) — Família Qwen da Alibaba; raciocínio e código, Apache 2.0
3. [DeepSeek V4.1](https://github.com/deepseek-ai/DeepSeek-V4.1) — MoE de código e raciocínio; Flash já no seletor
4. [Mistral/Devstral](https://github.com/mistralai/devstral) — Devstral focada em agente de código, Apache 2.0
5. [Gemma 4](https://github.com/google-deepmind/gemma) — Gemma 4 31B já no seletor; open weights Google
6. [Phi-4](https://github.com/microsoft/phi-4) — SLM da Microsoft, ótima em dispositivo
7. [GLM 5.3](https://github.com/zai-org/GLM-5.3) — Zhipu AI; 5.3 e Flash já no seletor
8. [Kimi K3](https://github.com/MoonshotAI/Kimi-K3) — Moonshot; híbrido MoE já no seletor
9. [Step 5](https://github.com/stepfun-ai/Step5) — StepFun; Step 5 Preview já no seletor
10. [GPT-OSS](https://github.com/openai/gpt-oss) — OpenAI open-weights; 20B já no seletor

## Inferência local/servidor (endpoint OpenAI-compatível)

11. [llama.cpp](https://github.com/ggml-org/llama.cpp) — Pure C/C++ inference engine with GGUF format support
12. [Ollama](https://github.com/ollama/ollama) — Dead-simple local LLM runner with a one-line install, model registry, and OpenAI-compatible API
13. [llama-cpp-python](https://github.com/abetlen/llama-cpp-python) — Official Python bindings for llama
14. [vLLM](https://github.com/vllm-project/vllm) — State-of-the-art serving engine with PagedAttention and continuous batching
15. [vLLM-Omni](https://github.com/vllm-project/vllm-omni) — Multi-modal inference stack extending vLLM for image, audio, and video generation workloads with a unified serving interface
16. [vLLM Production Stack](https://github.com/vllm-project/production-stack) — Kubernetes-native production stack for vLLM inference
17. [nano-vLLM](https://github.com/GeeeekExplorer/nano-vllm) — Minimalist vLLM implementation in ~1,200 lines of Python
18. [mistral.rs](https://github.com/EricLBuehler/mistral.rs) — Fast, flexible Rust-native LLM inference engine built on Candle
19. [TabbyAPI](https://github.com/theroyallab/tabbyAPI) — FastAPI-based API server for ExLlamaV2/V3 backends
20. [GPUStack](https://github.com/gpustack/gpustack) — GPU cluster manager that orchestrates inference engines like vLLM and SGLang
21. [Higress (Alibaba)](https://github.com/alibaba/higress) — AI-native API gateway born from Alibaba's internal infrastructure with 2+ years of production validation
22. [Bifrost](https://github.com/maximhq/bifrost) — LLM gateway with a unified OpenAI-compatible API across providers, routing, load balancing, fallbacks, guardrails, and observabili…
23. [vLLM-Ascend](https://github.com/vllm-project/vllm-ascend) — Hardware plugin for running vLLM on Huawei Ascend accelerators
24. [ik_llama.cpp](https://github.com/ikawrakow/ik_llama.cpp) — High-performance llama
25. [H2O LLM Studio](https://github.com/h2oai/h2o-llmstudio) — No-code GUI framework for fine-tuning LLMs
26. [LLM Compressor (vLLM)](https://github.com/vllm-project/llm-compressor) — Transformers-compatible library for applying various compression algorithms to LLMs for optimized deployment with vLLM
27. [LiteLLM](https://github.com/BerriAI/litellm) — AI Gateway to call 100+ LLM APIs in OpenAI format with unified cost tracking, guardrails, load balancing, and logging
28. [LocalAI](https://github.com/mudler/LocalAI) — Open-source AI engine running LLMs, vision, voice, image, and video models on any hardware
29. [Jan](https://github.com/janhq/jan) — Local-first AI app framework
30. [Tabby](https://github.com/TabbyML/tabby) — Self-hosted AI coding assistant

## Frameworks de agentes (roadmap backend @Solas)

31. [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) — The original autonomous AI agent framework that sparked the agent revolution
32. [LangGraph](https://github.com/langchain-ai/langgraph) — Stateful, controllable agent orchestration
33. [CrewAI](https://github.com/crewAIInc/crewAI) — Role-based agent framework
34. [AutoGen (AG2)](https://github.com/microsoft/autogen) — Flexible multi-agent conversation framework
35. [smolagents](https://github.com/huggingface/smolagents) — Lightweight agent framework centered on tool use and code-executing workflows
36. [LangChain](https://github.com/langchain-ai/langchain) — Foundational library for agents, chains, and memory
37. [Strands Agents](https://github.com/strands-agents/sdk-python) — Model-driven approach to building AI agents in just a few lines of code
38. [Agno](https://github.com/agno-agi/agno) — Build, run, and manage agentic software at scale
39. [VoltAgent](https://github.com/VoltAgent/voltagent) — TypeScript-first AI agent engineering platform with memory, RAG, workflows, MCP integration, and voice support
40. [PydanticAI](https://github.com/pydantic/pydantic-ai) — Type-safe AI agent framework from the creators of Pydantic
41. [DeepAgents](https://github.com/langchain-ai/deepagents) — Batteries-included LangChain agent harness for building and running structured multi-agent workflows with reusable runtime pattern…
42. [Mastra](https://github.com/mastra-ai/mastra) — TypeScript-first agent framework with built-in RAG, workflows, tool integrations, observability and observational memory
43. [Strands Agent Harness](https://github.com/strands-agents/harness-sdk) — Production SDK and harness runtime for building, monitoring, and controlling end-to-end AI agent lifecycles in Python and TypeScri…
44. [OpenHands (ex-OpenDevin)](https://github.com/All-Hands-AI/OpenHands) — Full-featured open-source AI software engineer
45. [Aider](https://github.com/paul-gauthier/aider) — Command-line pair-programming agent
46. [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent) — Lightweight coding agent for repository and issue-fixing workflows, designed for simple agentic software engineering experiments
47. [LangChain4j](https://github.com/langchain4j/langchain4j) — Java library for integrating LLMs into Java applications
48. [LangChain.rb](https://github.com/patterns-ai-core/langchainrb) — Build LLM-powered applications in Ruby
49. [Aider Desk](https://github.com/hotovo/aider-desk) — Platform for AI-powered software engineers
50. [Continue](https://github.com/continuedev/continue) — Open-source AI coding autopilot for VS Code & JetBrains
51. [Cline](https://github.com/cline/cline) — Open-source IDE coding agent that can edit files, run commands, and use tools with user approval
52. [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) — Lets LLMs run code locally
53. [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code) — AI coding agent that runs in your terminal to edit code, execute shell commands, and manage Model Context Protocol (MCP) servers a…
54. [Qwen Code](https://github.com/QwenLM/qwen-code) — Open-source AI agent for the terminal, optimized for Qwen series models

## Dev tools e editores com IA (referência de features)

55. [Nezha](https://github.com/hanshuaikang/nezha) — Code editor for the AI agents era
56. [Zed](https://github.com/zed-industries/zed) — High-performance, multiplayer code editor with built-in AI features
57. [Code Server](https://github.com/coder/code-server) — Run VS Code on any machine anywhere and access it in the browser
58. [Onlook](https://github.com/onlook-dev/onlook) — Open-source AI-first design and React editing environment for visually building and modifying frontend applications
59. [Garcon](https://github.com/cfal/garcon) — Browser and mobile workspace for running and steering parallel Claude Code, Codex, Cursor Agent, OpenCode, Amp, Droid, and Pi sess…
60. [screenshot-to-code](https://github.com/abi/screenshot-to-code) — MIT-licensed tool that turns screenshots, mockups, and Figma designs into frontend code

## RAG e memória

61. [Dify](https://github.com/langgenius/dify) — Production-ready agentic workflow platform
62. [Chroma](https://github.com/chroma-core/chroma) — Most popular open-source embedding database
63. [Qdrant](https://github.com/qdrant/qdrant) — High-performance vector search engine in Rust
64. [pgvector](https://github.com/pgvector/pgvector) — PostgreSQL extension for vector similarity search
65. [pgvectorscale](https://github.com/timescale/pgvectorscale) — PostgreSQL extension for scalable vector search with DiskANN algorithm
66. [Meilisearch](https://github.com/meilisearch/meilisearch) — Lightning-fast search engine API with AI-powered hybrid search
67. [FastEmbed (Qdrant)](https://github.com/qdrant/fastembed) — Lightweight, fast Python library for embedding generation with ONNX Runtime
68. [LlamaIndex](https://github.com/run-llama/llama_index) — Full-featured RAG pipeline with advanced indexing
69. [Haystack](https://github.com/deepset-ai/haystack) — End-to-end NLP and RAG framework
70. [txtai](https://github.com/neuml/txtai) — All-in-one AI framework for semantic search, LLM orchestration and language model workflows
71. [Flowise](https://github.com/FlowiseAI/Flowise) — Drag-and-drop LLM app builder

## Interfaces de chat (referência de UX)

72. [OpenClaw](https://github.com/openclaw/openclaw) — Local-first personal AI assistant with multi-channel integrations and full agentic task execution
73. [AstrBot](https://github.com/AstrBotDevs/AstrBot) — Multi-channel personal AI agent assistant and integration framework for messaging platforms, LLMs, and plugins
74. [Open WebUI](https://github.com/open-webui/open-webui) — Most popular self-hosted ChatGPT-style interface
75. [LibreChat](https://github.com/danny-avila/LibreChat) — Feature-packed multi-LLM interface
76. [HuggingChat (self-hosted)](https://github.com/huggingface/chat-ui) — Official open-source codebase for HuggingChat
77. [Khoj](https://github.com/khoj-ai/khoj) — Self-hostable personal AI assistant for search, chat, automation, and workflows over local and web data
78. [NextChat](https://github.com/ChatGPTNextWeb/NextChat) — Light and fast AI assistant supporting Web, iOS, macOS, Android, Linux, and Windows
79. [big-AGI](https://github.com/enricoros/big-AGI) — AI suite for power users with multi-model "Beam" chats, AI personas, voice, text-to-image, code execution, and PDF import
80. [Morphic](https://github.com/miurla/morphic) — AI-powered search engine with a generative UI
81. [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) — All-in-one RAG + agents platform

## Avaliação e benchmarks

82. [lm-evaluation-harness (EleutherAI)](https://github.com/EleutherAI/lm-evaluation-harness) — De-facto standard for generative model evaluation
83. [HELM (Stanford)](https://github.com/stanford-crfm/helm) — Holistic Evaluation of Language Models
84. [OpenCompass](https://github.com/open-compass/opencompass) — Evaluation platform for benchmarking language and multimodal models across large benchmark suites
85. [DeepEval](https://github.com/confident-ai/deepeval) — The "Pytest for LLMs"

## Segurança e guardrails

86. [NeMo Guardrails (NVIDIA)](https://github.com/NVIDIA-NeMo/Guardrails) — Programmable guardrails toolkit for LLM-based conversational systems
87. [Guardrails AI](https://github.com/guardrails-ai/guardrails) — Input/output validation framework for building reliable AI applications
88. [Presidio (Microsoft)](https://github.com/microsoft/presidio) — SDK for detecting, redacting, masking, and anonymizing sensitive personally identifiable information (PII) across text and images

## Voz, imagem e multimodal

89. [Flux.jl](https://github.com/FluxML/Flux.jl) — 100% pure-Julia ML stack with lightweight abstractions on top of native GPU and AD support
90. [Whisper](https://github.com/openai/whisper) — Canonical open speech-to-text model codebase with widespread ecosystem support and many downstream implementations
91. [EvoFlux](https://github.com/evoelsewhere/evoflux) — Local-first desktop workspace for coordinating AI agent teams across conversations, files, terminal, browser, Git, memory, plugins…
92. [ComfyUI](https://github.com/Comfy-Org/ComfyUI) — Node-based visual workflow editor for Stable Diffusion, FLUX, etc
93. [Stable Diffusion WebUI Forge - Neo](https://github.com/Haoming02/sd-webui-forge-classic) — Actively maintained Forge-based Stable Diffusion web UI with the familiar extension-driven workflow
94. [WhisperLive](https://github.com/collabora/WhisperLive) — Nearly-live implementation of OpenAI's Whisper for real-time speech-to-text transcription
95. [FluxGym](https://github.com/cocktailpeanut/fluxgym) — Dead simple FLUX LoRA training UI with LOW VRAM support (12GB/16GB/20GB)
96. [OpenSuperWhisper](https://github.com/Starmel/OpenSuperWhisper) — macOS dictation application providing real-time audio transcription and drag-and-drop file transcription using Whisper and Parakee…

97. [MCP Servers (oficial)](https://github.com/modelcontextprotocol/servers) — servidores MCP de referência (filesystem, git, fetch, etc.) para a tela Servidores MCP
98. [Playwright MCP](https://github.com/microsoft/playwright-mcp) — agente de navegador via MCP; pode dar web ao Acodex IA
99. [Firecrawl](https://github.com/firecrawl/firecrawl) — scraping de sites em markdown limpo para o chat
100. [crawl4ai](https://github.com/unclecode/crawl4ai) — crawler open source otimizado para LLMs
101. [freelm](https://github.com/shihabshahrier/freelm) — biblioteca que agrupa free tiers (Gemini, Groq, OpenRouter, Cloudflare) com rotação de keys; referência para o pool do Acodex
102. [Transformers (HF)](https://github.com/huggingface/transformers) — biblioteca padrão de modelos abertos (1M+ modelos)
103. [WhisperX](https://github.com/m-bain/whisperX) — whisper com timestamps por palavra; referência para transcrição
104. [kokoro](https://github.com/hexgrad/kokoro) — TTS leve e open para o modo voz
105. [Llama Factory](https://github.com/hiyouga/LLaMA-Factory) — fine-tuning fácil de modelos abertos
106. [Model Context Protocol](https://github.com/modelcontextprotocol/modelcontextprotocol) — protocolo MCP (o Acodex já fala)

## Prioridades de adoção
1. Já feito: modelos NIM free no seletor, MCP, tela cheia, log de raciocínio, voz e imagem (backend @Solas).
2. Próximo (backend @Solas): Mastra/VoltAgent para orquestração em TS; eval com DeepEval; guardrails NeMo.
3. Próximo (frontend @Vesper): presets Groq/OpenRouter free no seletor; UI inspirada em LibreChat/Open WebUI.

