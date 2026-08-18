import { api, errMessage } from '../api';
import { banner } from '../util';
import { t } from '../i18n';

export async function renderNewObject(container: HTMLElement) {
	const conn = await api.getConnection();
	if (!conn.connected) {
		container.innerHTML =
			`<h1>${t('newObject.title')}</h1>` + banner('warn', t('newObject.notConnected')) + `<p><a href="#/settings">${t('nav.settings')}</a></p>`;
		return;
	}

	container.innerHTML = `
		<h1>${t('newObject.title')}</h1>
		<div id="msg"></div>
		<div class="card">
			<form id="createForm">
				<label for="name">${t('newObject.nameLabel')}</label>
				<input id="name" name="name" required />

				<label for="description">${t('newObject.descriptionLabel')}</label>
				<input id="description" name="description" />

				<label for="objectType">${t('newObject.objectTypeLabel')}</label>
				<select id="objectType" name="objectType">
					<option value="IP">IP</option>
				</select>
				<p class="muted">${t('newObject.objectTypeNote')}</p>

				<button type="submit">${t('newObject.create')}</button>
			</form>
		</div>
	`;

	const msg = container.querySelector('#msg') as HTMLElement;
	const form = container.querySelector('#createForm') as HTMLFormElement;

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const name = String(fd.get('name') || '').trim();
		const description = String(fd.get('description') || '').trim();
		const objectType = String(fd.get('objectType') || 'IP').trim();

		if (!name) {
			msg.innerHTML = banner('error', t('newObject.nameRequired'));
			return;
		}

		try {
			const created = await api.createDynamicObject(name, description, objectType);
			location.hash = `#/objects/${encodeURIComponent(created.id)}`;
		} catch (err) {
			msg.innerHTML = banner('error', errMessage(err));
		}
	});
}
