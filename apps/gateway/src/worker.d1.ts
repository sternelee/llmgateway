import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createD1Database } from "@llmgateway/db";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { chat } from "./chat/chat";
import { models } from "./models";

import type { ServerTypes } from "./vars";

export const config = {
	servers: [
		{
			url: "https://gateway.leeapp.dev",
		},
	],
	openapi: "3.0.0",
	info: {
		version: "1.0.0",
		title: "LLMGateway API",
	},
	externalDocs: {
		url: "https://docs.llmgateway.io",
		description: "LLMGateway Documentation",
	},
};

interface CloudflareEnv {
	DB: D1Database;
	CACHE: KVNamespace;
	OPENAI_API_KEY: string;
	ANTHROPIC_API_KEY: string;
	GOOGLE_API_KEY: string;
}

export default {
	async fetch(
		request: Request,
		env: CloudflareEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		const app = new OpenAPIHono<ServerTypes & { Bindings: CloudflareEnv }>();

		// Initialize database
		const db = createD1Database(env.DB);

		app.use(
			"*",
			cors({
				origin: "https://docs.llmgateway.io",
				allowHeaders: ["Content-Type", "Cache-Control", "Authorization"],
				allowMethods: ["POST", "GET", "OPTIONS"],
				exposeHeaders: ["Content-Length"],
				maxAge: 600,
			}),
		);

		// Middleware to check for application/json content type on POST requests
		app.use("*", async (c, next) => {
			if (c.req.method === "POST") {
				const contentType = c.req.header("Content-Type");
				if (!contentType || !contentType.includes("application/json")) {
					throw new HTTPException(415, {
						message:
							"Unsupported Media Type: Content-Type must be application/json",
					});
				}
			}
			return await next();
		});

		// Middleware to inject environment bindings
		app.use("*", async (c, next) => {
			c.set("db", db);
			c.set("cache", env.CACHE);
			c.set("env", env);
			return await next();
		});

		app.onError((error, c) => {
			if (error instanceof HTTPException) {
				const status = error.status;

				if (status >= 500) {
					console.error("500 HTTPException", error);
				} else {
					console.log("non-500 HTTPException", error);
				}

				return c.json(
					{
						error: true,
						status,
						message: error.message || "An error occurred",
						...(error.res ? { details: error.res } : {}),
					},
					status,
				);
			}

			// For any other errors (non-HTTPException), return 500 Internal Server Error
			console.error("Unhandled error:", error);
			return c.json(
				{
					error: true,
					status: 500,
					message: "Internal Server Error",
				},
				500,
			);
		});

		const root = createRoute({
			summary: "Health check",
			description: "Health check endpoint.",
			operationId: "health",
			method: "get",
			path: "/",
			request: {},
			responses: {
				200: {
					content: {
						"application/json": {
							schema: z
								.object({
									message: z.string(),
									version: z.string(),
									health: z.object({
										status: z.string(),
										database: z.object({
											connected: z.boolean(),
											error: z.string().optional(),
										}),
										kv: z.object({
											connected: z.boolean(),
											error: z.string().optional(),
										}),
									}),
								})
								.openapi({}),
						},
					},
					description: "Health check response.",
				},
			},
		});

		app.openapi(root, async (c) => {
			const health = {
				status: "ok",
				database: { connected: false, error: undefined as string | undefined },
				kv: { connected: false, error: undefined as string | undefined },
			};

			try {
				// Test database connection
				await db.query.user.findFirst();
				health.database.connected = true;
			} catch (error) {
				health.status = "error";
				health.database.error = "Database connection failed";
				console.error("Database healthcheck failed:", error);
			}

			try {
				// Test KV connection
				await env.CACHE.get("health-check");
				health.kv.connected = true;
			} catch (error) {
				health.status = "error";
				health.kv.error = "KV connection failed";
				console.error("KV healthcheck failed:", error);
			}

			return c.json({
				message: "OK",
				version: "1.0.0",
				health,
			});
		});

		const v1 = new OpenAPIHono<ServerTypes & { Bindings: CloudflareEnv }>();

		v1.route("/chat", chat);
		v1.route("/models", models);

		app.route("/v1", v1);

		app.doc("/json", config);

		app.get("/docs", swaggerUI({ url: "/json" }));

		return await app.fetch(request, env, ctx);
	},
};
