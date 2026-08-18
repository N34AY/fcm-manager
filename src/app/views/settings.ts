import { api, errMessage } from '../api';
import { esc, banner } from '../util';

export async function renderSettings(container: HTMLElement) {
	const conn = await api.getConnection();

	container.innerHTML = `
		<h1>Settings</h1>
		<div id="msg"></div>
		<div class="banner warn">
			FMC calls run in the desktop app's Rust backend, not the webview — TLS
			certificate errors are bypassed there and there's no browser CORS
			restriction to work around.
		</div>
		<div class="card">
			<h2>Connection status</h2>
			<p id="connStatus">${conn.connected ? '🟢 Token set' : '⚪ No token set'}</p>
			<p class="muted" id="domainStatus">Domain: ${conn.domain ? `<code>${esc(conn.domain)}</code>` : 'not set'}</p>

			<form id="connForm">
				<label for="host">FMC host</label>
				<input id="host" name="host" value="${esc(conn.host)}" placeholder="https://fmc.example.com" />

				<label for="token">Token (paste X-auth-access-token from DevTools)</label>
				<input id="token" name="token" placeholder="leave blank if using username/password below" />

				<p class="muted" style="margin-top:16px;">— or fetch a fresh token with credentials (used once, not stored) —</p>

				<label for="username">Username</label>
				<input id="username" name="username" autocomplete="off" />

				<label for="password">Password</label>
				<input id="password" name="password" type="password" autocomplete="off" />

				<button type="submit">Save &amp; Connect</button>
			</form>
		</div>

		<div class="card" id="domainCard">
			<h2>Domain</h2>
			<p class="muted">Connect first to list domains.</p>
		</div>
	`;

	const msg = container.querySelector('#msg') as HTMLElement;
	const form = container.querySelector('#connForm') as HTMLFormElement;

	async function refreshStatus() {
		const c = await api.getConnection();
		(container.querySelector('#connStatus') as HTMLElement).textContent = c.connected ? '🟢 Token set' : '⚪ No token set';
		(container.querySelector('#domainStatus') as HTMLElement).innerHTML = `Domain: ${c.domain ? `<code>${esc(c.domain)}</code>` : 'not set'}`;
		return c;
	}

	async function renderDomainCard() {
		const card = container.querySelector('#domainCard') as HTMLElement;
		const c = await api.getConnection();
		if (!c.connected) {
			card.innerHTML = '<h2>Domain</h2><p class="muted">Connect first to list domains.</p>';
			return;
		}

		let domains;
		try {
			domains = await api.listDomains();
		} catch (err) {
			card.innerHTML =
				`<h2>Domain</h2>` +
				banner('error', "Couldn't auto-list domains: " + errMessage(err)) +
				`<label for="domainManual">Domain UUID (manual)</label>
				<input id="domainManual" value="${esc(c.domain)}" />
				<button id="saveDomainManual">Save domain</button>`;
			card.querySelector('#saveDomainManual')!.addEventListener('click', async () => {
				const val = (card.querySelector('#domainManual') as HTMLInputElement).value.trim();
				await api.setConnection({ domain: val });
				await refreshStatus();
				renderDomainCard();
			});
			return;
		}

		if (domains.length === 0) {
			card.innerHTML = '<h2>Domain</h2><p class="muted">No domains returned for this token yet.</p>';
		} else if (domains.length === 1) {
			card.innerHTML = `<h2>Domain</h2><p class="muted">Only one domain visible to this token — set automatically. ${esc(domains[0].name)} (<code>${esc(domains[0].uuid)}</code>)</p>`;
		} else {
			const options = domains
				.map((d) => `<option value="${esc(d.uuid)}" ${d.uuid === c.domain ? 'selected' : ''}>${esc(d.name)} (${esc(d.uuid)})</option>`)
				.join('');
			card.innerHTML = `
				<h2>Domain</h2>
				<label for="domainSelect">This token can see multiple domains — pick one</label>
				<select id="domainSelect">${options}</select>
				<button id="saveDomainSelect">Save domain</button>`;
			card.querySelector('#saveDomainSelect')!.addEventListener('click', async () => {
				const val = (card.querySelector('#domainSelect') as HTMLSelectElement).value;
				await api.setConnection({ domain: val });
				await refreshStatus();
				renderDomainCard();
			});
		}
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		msg.innerHTML = '';
		const fd = new FormData(form);
		const host = String(fd.get('host') || '').trim();
		const token = String(fd.get('token') || '').trim();
		const username = String(fd.get('username') || '').trim();
		const password = String(fd.get('password') || '').trim();

		try {
			if (host) await api.setConnection({ host });
			if (token) {
				await api.setConnection({ token });
			} else if (username && password) {
				await api.login(username, password);
			} else {
				throw new Error('Provide either a token or a username/password.');
			}

			try {
				const domains = await api.listDomains();
				if (domains.length === 1) await api.setConnection({ domain: domains[0].uuid });
			} catch {
				// Older FMC versions may not expose info/domain — leave for manual entry.
			}

			msg.innerHTML = banner('ok', 'Connection updated.');
			await refreshStatus();
			renderDomainCard();
		} catch (err) {
			msg.innerHTML = banner('error', errMessage(err));
		}
	});

	if (conn.connected) renderDomainCard();
}
