import { drizzle } from "drizzle-orm/d1";

import { d1Relations } from "./relations.d1";

export function createD1Database(db: D1Database) {
	return drizzle(db, {
		casing: "snake_case",
		relations: d1Relations,
	});
}

// For local development, you might want to use a different approach
export function createLocalD1Database() {
	// This would be used for local development with wrangler dev
	// You'll need to handle this based on your local development setup
	throw new Error("Local D1 database not configured. Use wrangler dev.");
}

export type DatabaseType = ReturnType<typeof createD1Database>;
