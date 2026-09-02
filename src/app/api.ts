import { invoke } from '@tauri-apps/api/core';
import { translateError } from './i18n';

export interface ConnectionInfo {
	host: string;
	domain: string;
	connected: boolean;
}

export interface DomainInfo {
	uuid: string;
	name: string;
}

export interface DynamicObject {
	id: string;
	name: string;
	description: string;
	objectType: string;
}

export interface AccessPolicyRef {
	id: string;
	name: string;
}

export interface DeviceRecord {
	id: string;
	name: string;
	license_caps: string[];
	access_policy: AccessPolicyRef | null;
}

export interface PolicyThreatUsage {
	usesIntrusionPolicy: boolean;
	reasons: string[];
}

export const api = {
	getConnection: () => invoke<ConnectionInfo>('get_connection'),
	setConnection: (opts: { host?: string; domain?: string; token?: string }) =>
		invoke<void>('set_connection', opts),
	login: (username: string, password: string) => invoke<void>('login', { username, password }),
	listDomains: () => invoke<DomainInfo[]>('list_domains'),

	listDynamicObjects: () => invoke<DynamicObject[]>('list_dynamic_objects'),
	getDynamicObject: (id: string) => invoke<DynamicObject>('get_dynamic_object', { id }),
	createDynamicObject: (name: string, description: string, objectType: string) =>
		invoke<DynamicObject>('create_dynamic_object', { name, description, objectType }),

	getMappings: (id: string) => invoke<string[]>('get_mappings', { id }),
	addMapping: (id: string, ip: string) => invoke<void>('add_mapping', { id, ip }),
	removeMapping: (id: string, ip: string) => invoke<void>('remove_mapping', { id, ip }),

	listDevices: () => invoke<DeviceRecord[]>('list_devices'),
	getPolicyThreatUsage: (policyId: string) => invoke<PolicyThreatUsage>('get_policy_threat_usage', { policyId }),
};

export function errMessage(err: unknown): string {
	const raw = err instanceof Error ? err.message : String(err);
	return translateError(raw);
}
