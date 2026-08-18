import { api, errMessage } from '../api';
import { banner } from '../util';

export async function renderNewObject(container: HTMLElement) {
	const conn = await api.getConnection();
	if (!conn.connected) {
		container.innerHTML = `<h1>New Dynamic Object</h1>` + banner('warn', 'Not connected. Go to Settings first.') + `<p><a href="#/settings">Settings</a></p>`;
		return;
	}

	container.innerHTML = `
		<h1>New Dynamic Object</h1>
		<div id="msg"></div>
		<div class="card">
			<form id="createForm">
				<label for="name">Name</label>
				<input id="name" name="name" required />

				<label for="description">Description</label>
				<input id="description" name="description" />

				<label for="objectType">Object type</label>
				<select id="objectType" name="objectType">
					<option value="IP">IP</option>
				</select>
				<p class="muted">Only IP is confirmed against the FMC API docs we have; other types are untested.</p>

				<button type="submit">Create</button>
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
			msg.innerHTML = banner('error', 'Name is required.');
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
