import crypto from "crypto";

import type { KVCache } from "./kv";
import type { DatabaseType } from "@llmgateway/db";

export function generateCacheKey(payload: Record<string, any>): string {
	return crypto
		.createHash("sha256")
		.update(JSON.stringify(payload))
		.digest("hex");
}

export async function setCache(
	kvCache: KVCache,
	key: string,
	value: any,
	expirationSeconds: number,
): Promise<void> {
	try {
		await kvCache.set(key, JSON.stringify(value), {
			expirationTtl: expirationSeconds,
		});
	} catch (error) {
		console.error("Error setting cache:", error);
	}
}

export async function getCache(
	kvCache: KVCache,
	key: string,
): Promise<any | null> {
	try {
		const cachedValue = await kvCache.get(key);
		if (!cachedValue) {
			return null;
		}
		return JSON.parse(cachedValue);
	} catch (error) {
		console.error("Error getting cache:", error);
		return null;
	}
}

export async function isCachingEnabled(
	db: DatabaseType,
	kvCache: KVCache,
	projectId: string,
): Promise<{ enabled: boolean; duration: number }> {
	try {
		const configCacheKey = `project_cache_config:${projectId}`;
		const cachedConfig = await getCache(kvCache, configCacheKey);

		if (cachedConfig) {
			return cachedConfig;
		}

		const project = await db.query.project.findFirst({
			where: (project, { eq }) => eq(project.id, projectId),
		});

		if (!project) {
			return { enabled: false, duration: 0 };
		}

		const config = {
			enabled: project.cachingEnabled || false,
			duration: project.cacheDurationSeconds || 60,
		};

		await setCache(kvCache, configCacheKey, config, 300);

		return config;
	} catch (error) {
		console.error("Error checking if caching is enabled:", error);
		throw error;
	}
}

export async function getProject(
	db: DatabaseType,
	kvCache: KVCache,
	projectId: string,
): Promise<any> {
	try {
		const projectCacheKey = `project:${projectId}`;
		const cachedProject = await getCache(kvCache, projectCacheKey);

		if (cachedProject) {
			return cachedProject;
		}

		const project = await db.query.project.findFirst({
			where: (project, { eq }) => eq(project.id, projectId),
		});

		if (project) {
			await setCache(kvCache, projectCacheKey, project, 60);
		}

		return project;
	} catch (error) {
		console.error("Error fetching project:", error);
		throw error;
	}
}

export async function getOrganization(
	db: DatabaseType,
	kvCache: KVCache,
	organizationId: string,
): Promise<any> {
	try {
		const orgCacheKey = `organization:${organizationId}`;
		const cachedOrg = await getCache(kvCache, orgCacheKey);

		if (cachedOrg) {
			return cachedOrg;
		}

		const organization = await db.query.organization.findFirst({
			where: (org, { eq }) => eq(org.id, organizationId),
		});

		if (organization) {
			await setCache(kvCache, orgCacheKey, organization, 60);
		}

		return organization;
	} catch (error) {
		console.error("Error fetching organization:", error);
		throw error;
	}
}

export async function getProviderKey(
	db: DatabaseType,
	kvCache: KVCache,
	organizationId: string,
	provider: string,
): Promise<any> {
	try {
		const providerKeyCacheKey = `provider_key:${organizationId}:${provider}`;
		const cachedProviderKey = await getCache(kvCache, providerKeyCacheKey);

		if (cachedProviderKey) {
			return cachedProviderKey;
		}

		const providerKey = await db.query.providerKey.findFirst({
			where: (pk, { eq, and }) =>
				and(
					eq(pk.status, "active"),
					eq(pk.organizationId, organizationId),
					eq(pk.provider, provider),
				),
		});

		if (providerKey) {
			await setCache(kvCache, providerKeyCacheKey, providerKey, 60);
		}

		return providerKey;
	} catch (error) {
		console.error("Error fetching provider key:", error);
		throw error;
	}
}

export async function getCustomProviderKey(
	db: DatabaseType,
	kvCache: KVCache,
	organizationId: string,
	customName: string,
): Promise<any> {
	try {
		const providerKeyCacheKey = `custom_provider_key:${organizationId}:${customName}`;
		const cachedProviderKey = await getCache(kvCache, providerKeyCacheKey);

		if (cachedProviderKey) {
			return cachedProviderKey;
		}

		const providerKey = await db.query.providerKey.findFirst({
			where: (pk, { eq, and }) =>
				and(
					eq(pk.status, "active"),
					eq(pk.organizationId, organizationId),
					eq(pk.provider, "custom"),
					eq(pk.name, customName),
				),
		});

		if (providerKey) {
			await setCache(kvCache, providerKeyCacheKey, providerKey, 60);
		}

		return providerKey;
	} catch (error) {
		console.error("Error fetching custom provider key:", error);
		throw error;
	}
}

export async function checkCustomProviderExists(
	db: DatabaseType,
	kvCache: KVCache,
	organizationId: string,
	providerCandidate: string,
): Promise<boolean> {
	try {
		const existsCacheKey = `custom_provider_exists:${organizationId}:${providerCandidate}`;
		const cachedResult = await getCache(kvCache, existsCacheKey);

		if (cachedResult !== null) {
			return cachedResult;
		}

		const providerKey = await db.query.providerKey.findFirst({
			where: (pk, { eq, and }) =>
				and(
					eq(pk.status, "active"),
					eq(pk.organizationId, organizationId),
					eq(pk.provider, "custom"),
					eq(pk.name, providerCandidate),
				),
		});

		const exists = !!providerKey;
		await setCache(kvCache, existsCacheKey, exists, 60);

		return exists;
	} catch (error) {
		console.error("Error checking if custom provider exists:", error);
		throw error;
	}
}

// Streaming cache data structure
interface StreamingCacheChunk {
	data: string;
	eventId: number;
	event?: string;
	timestamp: number;
}

interface StreamingCacheData {
	chunks: StreamingCacheChunk[];
	metadata: {
		model: string;
		provider: string;
		finishReason: string | null;
		totalChunks: number;
		duration: number;
		completed: boolean;
	};
}

export function generateStreamingCacheKey(
	payload: Record<string, any>,
): string {
	return `stream:${generateCacheKey(payload)}`;
}

export async function setStreamingCache(
	kvCache: KVCache,
	key: string,
	data: StreamingCacheData,
	expirationSeconds: number,
): Promise<void> {
	try {
		await kvCache.set(key, JSON.stringify(data), {
			expirationTtl: expirationSeconds,
		});
	} catch (error) {
		console.error("Error setting streaming cache:", error);
	}
}

export async function getStreamingCache(
	kvCache: KVCache,
	key: string,
): Promise<StreamingCacheData | null> {
	try {
		const cachedValue = await kvCache.get(key);
		if (!cachedValue) {
			return null;
		}
		return JSON.parse(cachedValue);
	} catch (error) {
		console.error("Error getting streaming cache:", error);
		return null;
	}
}
