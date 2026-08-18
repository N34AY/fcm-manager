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

export function startRouter(container: HTMLElement) {
	const render = async () => {
		const myToken = ++renderToken;
		const hash = location.hash.slice(1) || '/';
		for (const r of routes) {
			const m = hash.match(r.pattern);
			if (m) {
				const params: Record<string, string> = {};
				r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
				container.innerHTML = '<p class="muted">Loading…</p>';
				await r.handler(container, params);
				// If another navigation happened while this one was loading, drop this result.
				if (myToken !== renderToken) return;
				return;
			}
		}
		container.innerHTML = '<p>Not found.</p>';
	};
	window.addEventListener('hashchange', render);
	render();
}
