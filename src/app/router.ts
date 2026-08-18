import { t } from './i18n';

type RouteHandler = (container: HTMLElement, params: Record<string, string>) => void | Promise<void>;

const routes: { pattern: RegExp; keys: string[]; handler: RouteHandler }[] = [];

export function route(path: string, handler: RouteHandler) {
	const keys: string[] = [];
	const patternSrc = path.replace(/:[^/]+/g, (m) => {
		keys.push(m.slice(1));
		return '([^/]+)';
	});
	routes.push({ pattern: new RegExp(`^${patternSrc}$`), keys, handler });
}

let renderToken = 0;
let currentContainer: HTMLElement | null = null;

async function render() {
	const container = currentContainer;
	if (!container) return;
	const myToken = ++renderToken;
	const hash = location.hash.slice(1) || '/';
	for (const r of routes) {
		const m = hash.match(r.pattern);
		if (m) {
			const params: Record<string, string> = {};
			r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
			container.innerHTML = `<p class="muted">${t('common.loading')}</p>`;
			await r.handler(container, params);
			// If another navigation happened while this one was loading, drop this result.
			if (myToken !== renderToken) return;
			return;
		}
	}
	container.innerHTML = `<p>${t('common.notFound')}</p>`;
}

export function startRouter(container: HTMLElement) {
	currentContainer = container;
	window.addEventListener('hashchange', render);
	render();
}

/** Re-runs whatever route is currently active — used after a language switch. */
export function rerenderCurrent() {
	render();
}
