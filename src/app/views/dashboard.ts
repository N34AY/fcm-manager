import { api, errMessage } from '../api';
import { esc, banner } from '../util';

export async function renderDashboard(container: HTMLElement) {
	const conn = await api.getConnection();

	if (!conn.connected) {
		container.innerHTML =
			`<h1>Dynamic Objects</h1>` +
			banner('warn', 'Not connected to FMC. Go to Settings to set the domain and token.') +
			`<p><a href="#/settings">Go to Settings</a></p>`;
		return;
	}

	let html = `<h1>Dynamic Objects</h1><p class="muted">${esc(conn.host)} · domain <code>${esc(conn.domain || '(not set)')}</code></p>`;

	try {
		const [objects, managed] = await Promise.all([api.listDynamicObjects(), api.listManaged()]);
		const managedIds = new Set(managed.map((m) => m.id));

		const rows =
			objects
				.map(
					(o) => `
			<tr>
				<td>${esc(o.name)}</td>
				<td>${esc(o.objectType)}</td>
				<td><code>${esc(o.id)}</code></td>
				<td>${managedIds.has(o.id) ? '<span class="badge managed">created here</span>' : '<span class="badge external">external</span>'}</td>
				<td><a href="#/objects/${encodeURIComponent(o.id)}">View</a></td>
			</tr>`
				)
				.join('') || `<tr><td colspan="5" class="muted">No dynamic objects found.</td></tr>`;

		html += `
			<table>
				<thead><tr><th>Name</th><th>Type</th><th>ID</th><th>Owner</th><th></th></tr></thead>
				<tbody>${rows}</tbody>
			</table>`;
	} catch (err) {
		html += banner('error', 'Failed to load objects: ' + errMessage(err));
	}

	container.innerHTML = html;
}
