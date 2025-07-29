import { defineConfig } from "drizzle-kit";

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/schema.ts",
	out: "./migrations",
	casing: "snake_case",
	migrations: {
		prefix: "unix",
	},
	driver: "d1-http",
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
		databaseId: process.env.D1_DATABASE_ID || "",
		token: process.env.CLOUDFLARE_API_TOKEN || "",
	},
});
