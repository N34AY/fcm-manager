import { api, errMessage } from '../api';
import { esc, banner } from '../util';
import { t, deviceWord } from '../i18n';

export async function renderLicenses(container: HTMLElement) {
	const conn = await api.getConnection();

	let html = `
		<h1>${t('licenses.title')}</h1>
		<p class="muted">${t('licenses.description')}</p>
		<p class="muted">${t('licenses.notChecked')}</p>`;

	if (!conn.connected) {
		html += banner('warn', t('licenses.notConnected')) + `<p><a href="#/settings">${t('nav.settings')}</a></p>`;
		container.innerHTML = html;
		return;
	}

	container.innerHTML = html + `<p class="muted">${t('licenses.loadingDevices')}</p>`;

	try {
		const devices = await api.listDevices();
		const usageByPolicy = new Map<string, Awaited<ReturnType<typeof api.getPolicyThreatUsage>>>();

		type Row = {
			deviceName: string;
			hasThreat: boolean;
			policyName: string | null;
			usesIntrusion: boolean;
			reasons: string[];
			mismatch: boolean;
		};
		const rows: Row[] = [];

		for (const device of devices) {
			const policyId = device.access_policy?.id;
			let usage = { usesIntrusionPolicy: false, reasons: [] as string[] };
			if (policyId) {
				if (!usageByPolicy.has(policyId)) {
					usageByPolicy.set(policyId, await api.getPolicyThreatUsage(policyId));
				}
				usage = usageByPolicy.get(policyId)!;
			}
			const hasThreat = device.license_caps.some((l) => /THREAT|IPS/i.test(l));
			rows.push({
				deviceName: device.name,
				hasThreat,
				policyName: device.access_policy?.name ?? null,
				usesIntrusion: usage.usesIntrusionPolicy,
				reasons: usage.reasons,
				mismatch: usage.usesIntrusionPolicy && !hasThreat,
			});
		}

		const mismatchCount = rows.filter((r) => r.mismatch).length;

		html +=
			mismatchCount > 0
				? banner('error', t('licenses.mismatchFound', { count: mismatchCount, deviceWord: deviceWord(mismatchCount) }))
				: banner('ok', t('licenses.noMismatch'));

		const bodyRows =
			rows
				.map(
					(r) => `
			<tr>
				<td>${esc(r.deviceName)}</td>
				<td>${r.hasThreat ? t('licenses.threatYes') : t('licenses.threatMissing')}</td>
				<td>${r.policyName ? esc(r.policyName) : `<span class="muted">${t('licenses.noneAssigned')}</span>`}</td>
				<td title="${esc(r.reasons.join('\n'))}">${r.usesIntrusion ? t('licenses.usesYes', { count: r.reasons.length }) : t('licenses.usesNo')}</td>
				<td>${
					r.mismatch
						? `<span class="badge external" style="background:rgba(255,93,93,0.15); color:#ff5d5d;">${t('licenses.mismatch')}</span>`
						: `<span class="badge managed">${t('licenses.ok')}</span>`
				}</td>
			</tr>`
				)
				.join('') || `<tr><td colspan="5" class="muted">${t('licenses.noDevices')}</td></tr>`;

		html += `
			<table>
				<thead><tr><th>${t('licenses.colDevice')}</th><th>${t('licenses.colThreat')}</th><th>${t('licenses.colPolicy')}</th><th>${t('licenses.colUsesIntrusion')}</th><th>${t('licenses.colVerdict')}</th></tr></thead>
				<tbody>${bodyRows}</tbody>
			</table>`;
	} catch (err) {
		html += banner('error', t('licenses.failedToLoad', { msg: errMessage(err) }));
	}

	container.innerHTML = html;
}
