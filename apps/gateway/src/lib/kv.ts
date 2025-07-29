// Cloudflare KV-based cache implementation
export class KVCache {
	constructor(private kv: KVNamespace) {}

	async get(key: string): Promise<string | null> {
		try {
			return await this.kv.get(key);
		} catch (error) {
			console.error("Error getting from KV:", error);
			return null;
		}
	}

	async set(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void> {
		try {
			await this.kv.put(key, value, options);
		} catch (error) {
			console.error("Error setting to KV:", error);
			throw error;
		}
	}

	async del(key: string): Promise<void> {
		try {
			await this.kv.delete(key);
		} catch (error) {
			console.error("Error deleting from KV:", error);
			throw error;
		}
	}

	async ping(): Promise<string> {
		// KV doesn't have a ping method, so we'll just test with a simple operation
		await this.kv.get("ping-test");
		return "PONG";
	}
}

// For Cloudflare Workers, we'll use Durable Objects for queue functionality
// This is a simplified queue implementation using KV
export class KVQueue {
	constructor(
		private kv: KVNamespace,
		private queueName: string,
	) {}

	async publish(message: unknown): Promise<void> {
		try {
			const timestamp = Date.now();
			const messageId = `${this.queueName}:${timestamp}:${Math.random()}`;
			await this.kv.put(messageId, JSON.stringify(message));

			// Maintain a queue index
			const queueIndex = await this.kv.get(`${this.queueName}:index`);
			const index = queueIndex ? JSON.parse(queueIndex) : [];
			index.push(messageId);
			await this.kv.put(`${this.queueName}:index`, JSON.stringify(index));
		} catch (error) {
			console.error("Error publishing to KV queue:", error);
			throw error;
		}
	}

	async consume(count = 10): Promise<string[] | null> {
		try {
			const queueIndex = await this.kv.get(`${this.queueName}:index`);
			if (!queueIndex) {
				return null;
			}

			const index = JSON.parse(queueIndex);
			if (index.length === 0) {
				return null;
			}

			const messagesToProcess = index.splice(0, count);
			const messages: string[] = [];

			for (const messageId of messagesToProcess) {
				const message = await this.kv.get(messageId);
				if (message) {
					messages.push(message);
					await this.kv.delete(messageId);
				}
			}

			// Update the queue index
			await this.kv.put(`${this.queueName}:index`, JSON.stringify(index));

			return messages.length > 0 ? messages : null;
		} catch (error) {
			console.error("Error consuming from KV queue:", error);
			throw error;
		}
	}
}

export const LOG_QUEUE = "log_queue";

export function createKVCache(kv: KVNamespace): KVCache {
	return new KVCache(kv);
}

export function createKVQueue(kv: KVNamespace, queueName: string): KVQueue {
	return new KVQueue(kv, queueName);
}
