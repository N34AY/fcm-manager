import { api, errMessage } from '../api';
import { esc, banner } from '../util';
import { t } from '../i18n';

export async function renderSettings(container: HTMLElement) {
	const conn = await api.getConnection();

	container.innerHTML = `
		<h1>${t('settings.title')}</h1>
		<div id="msg"></div>
		<div class="banner warn">${t('settings.tlsNote')}</div>
		<div class="card">
			<h2>${t('settings.connectionStatus')}</h2>
			<p id="connStatus">${conn.connected ? t('settings.tokenSet') : t('settings.noToken')}</p>
			<p class="muted" id="domainStatus">${t('settings.domainLabel')}: ${conn.domain ? `<code>${esc(conn.domain)}</code>` : t('settings.domainNotSet')}</p>

			<form id="connForm">
				<label for="host">${t('settings.hostLabel')}</label>
				<input id="host" name="host" value="${esc(conn.host)}" placeholder="https://fmc.example.com" />

				<label for="token">${t('settings.tokenLabel')}</label>
				<input id="token" name="token" placeholder="${esc(t('settings.tokenPlaceholder'))}" />

				<p class="muted" style="margin-top:16px;">${t('settings.orFetch')}</p>

				<label for="username">${t('settings.usernameLabel')}</label>
				<input id="username" name="username" autocomplete="off" />

				<label for="password">${t('settings.passwordLabel')}</label>
				<input id="password" name="password" type="password" autocomplete="off" />

				<button type="submit">${t('settings.saveConnect')}</button>
			</form>
		</div>

		<div class="card" id="domainCard">
			<h2>${t('settings.domainTitle')}</h2>
			<p class="muted">${t('settings.connectFirst')}</p>
		</div>
	`;

	const msg = container.querySelector('#msg') as HTMLElement;
	const form = container.querySelector('#connForm') as HTMLFormElement;

	async function refreshStatus() {
		const c = await api.getConnection();
		(container.querySelector('#connStatus') as HTMLElement).textContent = c.connected ? t('settings.tokenSet') : t('settings.noToken');
		(container.querySelector('#domainStatus') as HTMLElement).innerHTML = `${t('settings.domainLabel')}: ${c.domain ? `<code>${esc(c.domain)}</code>` : t('settings.domainNotSet')}`;
		return c;
	}

	async function renderDomainCard() {
		const card = container.querySelector('#domainCard') as HTMLElement;
		const c = await api.getConnection();
		if (!c.connected) {
			card.innerHTML = `<h2>${t('settings.domainTitle')}</h2><p class="muted">${t('settings.connectFirst')}</p>`;
			return;
		}

		let domains;
		try {
			domains = await api.listDomains();
		} catch (err) {
			card.innerHTML =
				`<h2>${t('settings.domainTitle')}</h2>` +
				banner('error', t('settings.domainAutoError', { msg: errMessage(err) })) +
				`<label for="domainManual">${t('settings.domainManualLabel')}</label>
				<input id="domainManual" value="${esc(c.domain)}" />
				<button id="saveDomainManual">${t('settings.saveDomain')}</button>`;
			card.querySelector('#saveDomainManual')!.addEventListener('click', async () => {
				const val = (card.querySelector('#domainManual') as HTMLInputElement).value.trim();
				await api.setConnection({ domain: val });
				await refreshStatus();
				renderDomainCard();
			});
			return;
		}

		if (domains.length === 0) {
			card.innerHTML = `<h2>${t('settings.domainTitle')}</h2><p class="muted">${t('settings.noDomains')}</p>`;
		} else if (domains.length === 1) {
			card.innerHTML = `<h2>${t('settings.domainTitle')}</h2><p class="muted">${t('settings.onlyOneDomain', { name: domains[0].name, uuid: domains[0].uuid })}</p>`;
		} else {
			const options = domains
				.map((d) => `<option value="${esc(d.uuid)}" ${d.uuid === c.domain ? 'selected' : ''}>${esc(d.name)} (${esc(d.uuid)})</option>`)
				.join('');
			card.innerHTML = `
				<h2>${t('settings.domainTitle')}</h2>
				<label for="domainSelect">${t('settings.multipleDomains')}</label>
				<select id="domainSelect">${options}</select>
				<button id="saveDomainSelect">${t('settings.saveDomain')}</button>`;
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
				throw new Error(t('errors.provideCredentials'));
			}

			try {
				const domains = await api.listDomains();
				if (domains.length === 1) await api.setConnection({ domain: domains[0].uuid });
			} catch {
				// Older FMC versions may not expose info/domain — leave for manual entry.
			}

			msg.innerHTML = banner('ok', t('settings.connectionUpdated'));
			await refreshStatus();
			renderDomainCard();
		} catch (err) {
			msg.innerHTML = banner('error', errMessage(err));
		}
	});

	if (conn.connected) renderDomainCard();
}
