export function esc(s: string): string {
	const d = document.createElement('div');
	d.textContent = s;
	return d.innerHTML;
}

export function banner(kind: 'warn' | 'error' | 'ok', text: string): string {
	return `<div class="banner ${kind}">${esc(text)}</div>`;
}
