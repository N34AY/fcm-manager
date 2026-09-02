import { api, errMessage } from '../api';
import { esc, banner } from '../util';
import { t } from '../i18n';

export async function renderObjectDetail(container: HTMLElement, params: Record<string, string>) {
	const id = params.id;
	await draw(container, id, null);
}

async function draw(container: HTMLElement, id: string, flash: { kind: 'ok' | 'error'; text: string } | null) {
	let obj;
	let mappings: string[] = [];
	let loadError: string | null = null;

	try {
		obj = await api.getDynamicObject(id);
		mappings = await api.getMappings(id);
	} catch (err) {
		loadError = errMessage(err);
	}

	let html = `<p><a href="#/">${t('common.back')}</a></p>`;
	if (flash) html += banner(flash.kind, flash.text);
	if (loadError) html += banner('error', t('objectDetail.failedToLoad', { msg: loadError }));

	if (obj) {
		html += `
			<h1>${esc(obj.name)}</h1>
			<p class="muted"><code>${esc(obj.id)}</code> · ${t('objectDetail.typeLabel')} ${esc(obj.objectType)}</p>`;

		html += `<div class="card"><h2>${t('objectDetail.mappingsTitle')}</h2><table><thead><tr><th>IP</th><th></th></tr></thead><tbody>`;
		if (mappings.length === 0) {
			html += `<tr><td class="muted">${t('objectDetail.noMappings')}</td></tr>`;
		} else {
			for (const ip of mappings) {
				html += `<tr><td>${esc(ip)}</td><td><button type="button" class="secondary remove-ip" data-ip="${esc(ip)}">${t('objectDetail.remove')}</button></td></tr>`;
			}
		}
		html += `</tbody></table>`;

		html += `
			<form id="addIpForm" class="row" style="margin-top:16px;">
				<div><label for="ip">${t('objectDetail.addIpLabel')}</label><input id="ip" name="ip" placeholder="172.16.20.72" required /></div>
				<button type="submit">${t('objectDetail.add')}</button>
			</form>`;
		html += `</div>`;
	}

	container.innerHTML = html;
	if (!obj) return;

	container.querySelectorAll<HTMLButtonElement>('.remove-ip').forEach((btn) => {
		btn.addEventListener('click', async () => {
			btn.disabled = true;
			try {
				await api.removeMapping(id, btn.dataset.ip!);
				await draw(container, id, { kind: 'ok', text: t('objectDetail.mappingRemoved') });
			} catch (err) {
				await draw(container, id, { kind: 'error', text: errMessage(err) });
			}
		});
	});

	const addForm = container.querySelector('#addIpForm') as HTMLFormElement | null;
	addForm?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const ip = (container.querySelector('#ip') as HTMLInputElement).value.trim();
		if (!ip) return;
		try {
			await api.addMapping(id, ip);
			await draw(container, id, { kind: 'ok', text: t('objectDetail.mappingAdded') });
		} catch (err) {
			await draw(container, id, { kind: 'error', text: errMessage(err) });
		}
	});
}
