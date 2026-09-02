import { api, errMessage } from '../api';
import { esc, banner } from '../util';
import { t } from '../i18n';

export async function renderDashboard(container: HTMLElement) {
	const conn = await api.getConnection();

	if (!conn.connected) {
		container.innerHTML =
			`<h1>${t('dashboard.title')}</h1>` +
			banner('warn', t('dashboard.notConnected')) +
			`<p><a href="#/settings">${t('dashboard.goToSettings')}</a></p>`;
		return;
	}

	let html = `<h1>${t('dashboard.title')}</h1><p class="muted">${esc(conn.host)} · <code>${esc(conn.domain || t('settings.domainNotSet'))}</code></p>`;

	try {
		const objects = await api.listDynamicObjects();

		const rows =
			objects
				.map(
					(o) => `
			<tr>
				<td>${esc(o.name)}</td>
				<td>${esc(o.objectType)}</td>
				<td><code>${esc(o.id)}</code></td>
				<td><a href="#/objects/${encodeURIComponent(o.id)}">${t('dashboard.view')}</a></td>
			</tr>`
				)
				.join('') || `<tr><td colspan="4" class="muted">${t('dashboard.noObjects')}</td></tr>`;

		html += `
			<table>
				<thead><tr><th>${t('dashboard.colName')}</th><th>${t('dashboard.colType')}</th><th>${t('dashboard.colId')}</th><th></th></tr></thead>
				<tbody>${rows}</tbody>
			</table>`;
	} catch (err) {
		html += banner('error', t('dashboard.failedToLoad', { msg: errMessage(err) }));
	}

	container.innerHTML = html;
}
