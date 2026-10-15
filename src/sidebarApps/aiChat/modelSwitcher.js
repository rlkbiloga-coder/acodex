import {
	fetchAvailableModels,
	getProviderForBaseUrl,
	listCatalogModels,
} from "lib/acodexAi/models";
import { NVIDIA_NIM_MODELS } from "./nimPresets";
import { POWER_MODES } from "./powerMode";

/**
 * Command-palette model switcher (shadcn/ui + cmdk style) for Acodex AI.
 *
 * Everything is data-driven: the palette merges the static catalog
 * (lib/acodexAi/models.js) with whatever the provider's /models endpoint
 * returns live. Add a provider or a model and it shows up automatically.
 */

/**
 * @param {object} options
 * @param {() => { baseUrl: string, apiKey: string, model: string }} options.getConfig
 * @param {(modelId: string, baseUrl?: string) => void} options.onSelect
 * @param {(modeId: string) => void} [options.onSelectMode] Seleção do modo de consumo.
 * @param {() => string} [options.getActiveMode] Modo de consumo atual ("low"/"padrao"/"maximo").
 * @returns {{ $toggle: HTMLButtonElement, open: () => void }}
 */
export function createModelSwitcher({
	getConfig,
	onSelect,
	onSelectMode,
	getActiveMode,
}) {
	/** @type {HTMLDivElement} */
	let $overlay;
	/** @type {HTMLInputElement} */
	let $search;
	/** @type {HTMLDivElement} */
	let $list;
	let activeIndex = 0;
	let flatItems = [];
	let abortFetch = null;

	const $toggle = (
		<button
			type="button"
			className="ai-model-toggle"
			title="Trocar modelo"
			aria-label="Trocar modelo"
			onclick={() => open()}
		>
			<span className="icon tune" />
			<span className="ai-model-toggle-provider" />
			<span className="ai-model-toggle-name">
				{getConfig().model || "sem modelo"}
			</span>
			<span className="icon expand_more" />
		</button>
	);

	function currentModel() {
		return getConfig().model;
	}

	function buildOverlay() {
		if ($overlay) return;
		$overlay = (
			<div
				className="ai-model-palette"
				role="dialog"
				aria-label="Selecionar modelo"
			></div>
		);
		$search = (
			<input
				className="ai-model-search"
				type="text"
				placeholder="Buscar modelo ou provedor..."
				aria-label="Buscar modelo"
				oninput={() => render()}
				onkeydown={onSearchKeydown}
			/>
		);
		$list = <div className="ai-model-list scroll" role="listbox"></div>;
		$overlay.append(
			<div className="ai-model-panel">
				<div className="ai-model-head">
					<span className="icon brain" />
					{$search}
					<button
						type="button"
						className="ai-model-refresh icon-button"
						title="Buscar modelos no servidor"
						aria-label="Atualizar do servidor"
						onclick={() => refreshFromServer()}
					>
						<span className="icon refresh" />
					</button>
				</div>
				<div className="ai-model-hint">
					↑ ↓ navegar · Enter selecionar · Esc fecha
				</div>
				{$list}
			</div>,
		);
		$overlay.addEventListener("click", (e) => {
			if (e.target === $overlay) close();
		});
		document.body.append($overlay);
	}

	function open() {
		buildOverlay();
		$search.value = "";
		render();
		$overlay.classList.add("open");
		$search.focus();
	}

	function close() {
		$overlay?.classList.remove("open");
		abortFetch?.abort();
		abortFetch = null;
	}

	function providerName(baseUrl) {
		try {
			return new URL(baseUrl).hostname.replace(/^api\.|\.com$|\.ai$/g, "");
		} catch {
			return "provedor";
		}
	}

	/**
	 * Gathers everything that should appear right now: catalog entries,
	 * the currently configured model (if not listed anywhere) and any
	 * models fetched live from the provider.
	 * @returns {{ group: string, accent: string, items: {id: string, label: string, badges: string[], baseUrl?: string}[] }[]}
	 */
	function collectEntries() {
		const config = getConfig();
		const provider = getProviderForBaseUrl(config.baseUrl);
		const byProvider = new Map();

		for (const { provider: p, model } of listCatalogModels()) {
			if (!byProvider.has(p.label)) {
				byProvider.set(p.label, {
					group: p.label,
					accent: p.accent || "var(--active-color)",
					items: [],
				});
			}
			byProvider.get(p.label).items.push({ ...model, baseUrl: p.baseUrl });
		}

		// Modo de consumo (low é o padrão).
		const activeMode = getActiveMode?.() || "low";
		if (onSelectMode) {
			byProvider.set("Modo de consumo", {
				group: "Modo de consumo",
				accent: "#f59e0b",
				items: Object.entries(POWER_MODES).map(([id, mode]) => ({
					id: `mode:${id}`,
					label: mode.label,
					badges: [id === activeMode ? "ativo" : mode.hint],
					onSelectMode: () => onSelectMode(id),
				})),
			});
		}

		// NVIDIA NIM: modelos gratuitos do build.nvidia.com.
		const nimIds = new Set(NVIDIA_NIM_MODELS.map((model) => model.id));
		const catalogIds = new Set(
			[...byProvider.values()].flatMap((group) =>
				group.items.map((item) => item.id),
			),
		);
		byProvider.set("NVIDIA NIM · grátis", {
			group: "NVIDIA NIM · grátis",
			accent: "#76b900",
			items: NVIDIA_NIM_MODELS.filter((model) => !catalogIds.has(model.id)),
		});

		// Live models discovered on the current endpoint.
		const live = (
			$overlay?.dataset.liveModels?.split("\n").filter(Boolean) || []
		).filter((id) => !catalogIds.has(id) && !nimIds.has(id));
		if (live.length) {
			const groupName = `${provider?.label || providerName(config.baseUrl)} · do servidor`;
			byProvider.set(groupName, {
				group: groupName,
				accent: provider?.accent || "var(--active-color)",
				items: live.map((id) => ({ id, label: id, badges: ["ao vivo"] })),
			});
		}

		// The configured model must always be visible.
		const everywhere = [...byProvider.values()].flatMap((g) => g.items);
		if (config.model && !everywhere.some((i) => i.id === config.model)) {
			byProvider.set("Personalizado", {
				group: "Personalizado",
				accent: "#f59e0b",
				items: [
					{
						id: config.model,
						label: config.model,
						badges: ["em uso"],
						baseUrl: config.baseUrl,
					},
				],
			});
		}

		return [...byProvider.values()];
	}

	function matches(item, query) {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		return `${item.id} ${item.label} ${item.badges?.join(" ") || ""}`
			.toLowerCase()
			.includes(q);
	}

	function render() {
		if (!$list) return;
		const query = $search.value;
		const groups = collectEntries()
			.map((g) => ({ ...g, items: g.items.filter((i) => matches(i, query)) }))
			.filter((g) => g.items.length);

		$list.replaceChildren();
		flatItems = [];
		for (const group of groups) {
			const $group = <div className="ai-model-group"></div>;
			$group.append(
				<div className="ai-model-group-label">
					<span
						className="ai-model-group-dot"
						style={`background: ${group.accent}`}
					/>
					{group.group}
				</div>,
			);
			for (const item of group.items) {
				const index = flatItems.length;
				const isModeItem = item.id?.startsWith("mode:");
				const selected = !isModeItem && item.id === currentModel();
				const $item = (
					<button
						type="button"
						className={`ai-model-item ${selected ? "selected" : ""}`}
						role="option"
						aria-selected={selected}
						onclick={() => choose(item)}
					>
						<span className="ai-model-item-name">{item.label}</span>
						<span className="ai-model-item-badges">
							{item.badges?.map((b) => (
								<span className="ai-model-badge">{b}</span>
							))}
						</span>
						<span className={`icon ${selected ? "check_circle" : "circle"}`} />
					</button>
				);
				$item.addEventListener("mousemove", () => setActive(index, false));
				$group.append($item);
				flatItems.push({ item, $item });
			}
			$list.append($group);
		}

		if (!flatItems.length) {
			$list.append(
				<div className="ai-model-empty">
					Nenhum modelo encontrado para “{$search.value}”
				</div>,
			);
		}

		const currentIdx = flatItems.findIndex((f) => f.item.id === currentModel());
		activeIndex = query.trim() ? 0 : Math.max(0, currentIdx);
		setActive(activeIndex, true, false);
	}

	/**
	 * @param {number} index
	 * @param {boolean} [scroll]
	 * @param {boolean} [updateIndex]
	 */
	function setActive(index, scroll = true, updateIndex = true) {
		if (updateIndex) activeIndex = index;
		for (const [i, { $item }] of flatItems.entries()) {
			$item.classList.toggle("active", i === activeIndex);
		}
		if (scroll) {
			flatItems[activeIndex]?.$item.scrollIntoView({ block: "nearest" });
		}
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function onSearchKeydown(e) {
		if (e.key === "Escape") {
			e.preventDefault();
			close();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (flatItems.length) setActive((activeIndex + 1) % flatItems.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (flatItems.length)
				setActive((activeIndex - 1 + flatItems.length) % flatItems.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const entry = flatItems[activeIndex];
			if (entry) choose(entry.item);
		}
	}

	function choose(item) {
		if (item.id?.startsWith("mode:") && item.onSelectMode) {
			item.onSelectMode();
			close();
			return;
		}
		onSelect(item.id, item.baseUrl);
		updateToggleLabel();
		close();
	}

	function updateToggleLabel() {
		const model = currentModel();
		const provider = getProviderForBaseUrl(getConfig().baseUrl);
		$toggle.querySelector(".ai-model-toggle-name").textContent =
			model || "sem modelo";
		$toggle.querySelector(".ai-model-toggle-provider").textContent = provider
			? provider.label
			: "";
		$toggle.classList.toggle("known-provider", Boolean(provider));
	}

	async function refreshFromServer() {
		if (!$overlay) return;
		const config = getConfig();
		const $refresh = $overlay.querySelector(".ai-model-refresh .icon");
		$refresh?.classList.add("spin");
		abortFetch?.abort();
		abortFetch = new AbortController();
		try {
			const models = await fetchAvailableModels({
				baseUrl: config.baseUrl,
				apiKey: config.apiKey,
				fetchImpl: (url, init) =>
					globalThis.fetch(url, { ...init, signal: abortFetch.signal }),
			});
			$overlay.dataset.liveModels = models.join("\n");
		} catch {
			$overlay.dataset.liveModels = "";
		} finally {
			$refresh?.classList.remove("spin");
			render();
		}
	}

	updateToggleLabel();

	return { $toggle, open };
}
