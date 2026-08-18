import { api, errMessage } from '../api';
import { esc, banner } from '../util';

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

	const managedList = await api.listManaged().catch(() => []);
	const managed = managedList.some((m) => m.id === id);

	let html = `<p><a href="#/">&larr; Dashboard</a></p>`;
	if (flash) html += banner(flash.kind, flash.text);
	if (loadError) html += banner('error', 'Failed to load: ' + loadError);

	if (obj) {
		html += `
			<h1>${esc(obj.name)}</h1>
			<p class="muted">
				<code>${esc(obj.id)}</code> · type ${esc(obj.objectType)}
				${managed ? '<span class="badge managed">created here</span>' : '<span class="badge external">external</span>'}
			</p>`;

		if (!managed) {
			html += banner(
				'warn',
				"This object was not created by this app — read-only here. Mapping changes and deletion are disabled to avoid touching objects this tool doesn't own."
			);
		}

		html += `<div class="card"><h2>IP mappings</h2><table><thead><tr><th>IP</th>${managed ? '<th></th>' : ''}</tr></thead><tbody>`;
		if (mappings.length === 0) {
			html += `<tr><td class="muted">No mappings.</td></tr>`;
		} else {
			for (const ip of mappings) {
				html += `<tr><td>${esc(ip)}</td>`;
				if (managed) html += `<td><button type="button" class="secondary remove-ip" data-ip="${esc(ip)}">Remove</button></td>`;
				html += `</tr>`;
			}
		}
		html += `</tbody></table>`;

		if (managed) {
			html += `
				<form id="addIpForm" class="row" style="margin-top:16px;">
					<div><label for="ip">Add IP</label><input id="ip" name="ip" placeholder="172.16.20.72" required /></div>
					<button type="submit">Add</button>
				</form>`;
		}
		html += `</div>`;

		if (managed) {
			html += `
				<div class="card">
					<h2>Danger zone</h2>
					<button type="button" id="deleteBtn" class="danger">Delete object</button>
				</div>`;
		}
	}

	container.innerHTML = html;
	if (!obj) return;

	container.querySelectorAll<HTMLButtonElement>('.remove-ip').forEach((btn) => {
		btn.addEventListener('click', async () => {
			btn.disabled = true;
			try {
				await api.removeMapping(id, btn.dataset.ip!);
				await draw(container, id, { kind: 'ok', text: 'Mapping removed.' });
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
			await draw(container, id, { kind: 'ok', text: 'Mapping added.' });
		} catch (err) {
			await draw(container, id, { kind: 'error', text: errMessage(err) });
		}
	});

	const deleteBtn = container.querySelector('#deleteBtn') as HTMLButtonElement | null;
	deleteBtn?.addEventListener('click', async () => {
		if (!confirm('Delete this dynamic object? This cannot be undone.')) return;
		deleteBtn.disabled = true;
		try {
			await api.deleteDynamicObject(id);
			location.hash = '#/';
		} catch (err) {
			await draw(container, id, { kind: 'error', text: errMessage(err) });
		}
	});
}
