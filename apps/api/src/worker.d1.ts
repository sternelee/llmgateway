import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createD1Database, type DatabaseType } from "@llmgateway/db";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { authHandler } from "./auth/handler";
import { routes } from "./routes";
import { beacon } from "./routes/beacon";
import { stripeRoutes } from "./stripe";

import type { ServerTypes } from "./vars";

export const config = {
	servers: [
		{
			url: "https://llm.leeapp.dev",
		},
	],
	openapi: "3.0.0",
	info: {
		version: "1.0.0",
		title: "LLMGateway API",
	},
};

interface CloudflareEnv {
	DB: D1Database;
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	POSTHOG_API_KEY: string;
	BETTER_AUTH_SECRET: string;
}

interface Variables {
	db: DatabaseType;
	env: CloudflareEnv;
}

export default {
	async fetch(
		request: Request,
		env: CloudflareEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		const app = new OpenAPIHono<
			ServerTypes & { Bindings: CloudflareEnv } & { Variables: Variables }
		>();

		// Initialize database
		const db = createD1Database(env.DB);

		app.use(
			"*",
			cors({
				origin: "https://leeapp.dev",
				allowHeaders: ["Content-Type", "Authorization", "Cache-Control"],
				allowMethods: ["POST", "GET", "OPTIONS", "PUT", "PATCH", "DELETE"],
				exposeHeaders: ["Content-Length"],
				maxAge: 600,
				credentials: true,
			}),
		);

		// Middleware to inject environment bindings
		app.use("*", async (c, next) => {
			c.set("db", db);
			c.set("env", env);
			return await next();
		});

		app.onError((error, c) => {
			if (error instanceof HTTPException) {
				const status = error.status;

				if (status >= 500) {
					console.log("HTTPException", error);
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
			};

			try {
				await db.query.user.findFirst();
				health.database.connected = true;
			} catch (error) {
				health.status = "error";
				health.database.error = "Database connection failed";
				console.error("Database healthcheck failed:", error);
			}

			return c.json({
				message: "OK",
				version: "1.0.0",
				health,
			});
		});

		app.route("/stripe", stripeRoutes);
		app.route("/", beacon);
		app.doc("/json", config);
		app.get("/docs", swaggerUI({ url: "./json" }));
		app.route("/", authHandler);
		app.route("/", routes);

		return await app.fetch(request, env, ctx);
	},
};
