import { api, errMessage } from '../api';
import { esc, banner } from '../util';

export async function renderLicenses(container: HTMLElement) {
	const conn = await api.getConnection();

	let html = `
		<h1>License Check</h1>
		<p class="muted">
			Cross-checks each device's licenses against whether its assigned Access
			Control Policy uses an Intrusion Policy anywhere (rules or default
			action) — the thing that requires the Threat license. Read-only, makes
			no changes.
		</p>
		<p class="muted">
			Not checked: Intrusion Policy applied via a Security Intelligence block
			response. If everything below looks fine but deploy still fails, check
			that manually under the policy's Security Intelligence tab.
		</p>`;

	if (!conn.connected) {
		html += banner('warn', 'Not connected to FMC. Go to Settings first.') + `<p><a href="#/settings">Settings</a></p>`;
		container.innerHTML = html;
		return;
	}

	container.innerHTML = html + `<p class="muted">Loading devices…</p>`;

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
				? banner('error', `${mismatchCount} device${mismatchCount > 1 ? 's' : ''} likely to fail deploy with the THREAT license error.`)
				: banner('ok', 'No license/policy mismatches found.');

		const bodyRows =
			rows
				.map(
					(r) => `
			<tr>
				<td>${esc(r.deviceName)}</td>
				<td>${r.hasThreat ? '✅ yes' : '❌ missing'}</td>
				<td>${r.policyName ? esc(r.policyName) : '<span class="muted">none assigned</span>'}</td>
				<td title="${esc(r.reasons.join('\n'))}">${r.usesIntrusion ? `yes (${r.reasons.length})` : 'no'}</td>
				<td>${
					r.mismatch
						? '<span class="badge external" style="background:rgba(255,93,93,0.15); color:#ff5d5d;">MISMATCH</span>'
						: '<span class="badge managed">OK</span>'
				}</td>
			</tr>`
				)
				.join('') || `<tr><td colspan="5" class="muted">No devices found.</td></tr>`;

		html += `
			<table>
				<thead><tr><th>Device</th><th>Threat license</th><th>Access Policy</th><th>Uses Intrusion Policy?</th><th>Verdict</th></tr></thead>
				<tbody>${bodyRows}</tbody>
			</table>`;
	} catch (err) {
		html += banner('error', 'Failed to load: ' + errMessage(err));
	}

	container.innerHTML = html;
}
