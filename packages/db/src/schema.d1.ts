import {
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { customAlphabet } from "nanoid";

export const UnifiedFinishReason = {
	COMPLETED: "completed",
	LENGTH_LIMIT: "length_limit",
	CONTENT_FILTER: "content_filter",
	TOOL_CALLS: "tool_calls",
	GATEWAY_ERROR: "gateway_error",
	UPSTREAM_ERROR: "upstream_error",
	CANCELED: "canceled",
	UNKNOWN: "unknown",
} as const;

export type UnifiedFinishReason =
	(typeof UnifiedFinishReason)[keyof typeof UnifiedFinishReason];

const generate = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
);

export const shortid = (size = 20) => generate(size);

export const user = sqliteTable("user", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	name: text(),
	email: text().notNull().unique(),
	emailVerified: integer({ mode: "boolean" }).notNull().default(false),
	image: text(),
	onboardingCompleted: integer({ mode: "boolean" }).notNull().default(false),
});

export const session = sqliteTable("session", {
	id: text().primaryKey().$defaultFn(shortid),
	expiresAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	token: text().notNull().unique(),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	ipAddress: text(),
	userAgent: text(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text().primaryKey().$defaultFn(shortid),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: integer({ mode: "timestamp" }),
	refreshTokenExpiresAt: integer({ mode: "timestamp" }),
	scope: text(),
	password: text(),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
	id: text().primaryKey().$defaultFn(shortid),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	createdAt: integer({ mode: "timestamp" }),
	updatedAt: integer({ mode: "timestamp" }),
});

export const organization = sqliteTable("organization", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	name: text().notNull(),
	stripeCustomerId: text().unique(),
	stripeSubscriptionId: text().unique(),
	credits: text().notNull().default("0"), // SQLite doesn't have decimal, use text
	autoTopUpEnabled: integer({ mode: "boolean" }).notNull().default(false),
	autoTopUpThreshold: text().default("10"),
	autoTopUpAmount: text().default("10"),
	plan: text({ enum: ["free", "pro"] })
		.notNull()
		.default("free"),
	planExpiresAt: integer({ mode: "timestamp" }),
	subscriptionCancelled: integer({ mode: "boolean" }).notNull().default(false),
	trialStartDate: integer({ mode: "timestamp" }),
	trialEndDate: integer({ mode: "timestamp" }),
	isTrialActive: integer({ mode: "boolean" }).notNull().default(false),
	retentionLevel: text({ enum: ["retain", "none"] })
		.notNull()
		.default("retain"),
	status: text({ enum: ["active", "inactive", "deleted"] }).default("active"),
});

export const transaction = sqliteTable("transaction", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text({
		enum: [
			"subscription_start",
			"subscription_cancel",
			"subscription_end",
			"credit_topup",
		],
	}).notNull(),
	amount: text(),
	creditAmount: text(),
	currency: text().notNull().default("USD"),
	status: text({
		enum: ["pending", "completed", "failed"],
	})
		.notNull()
		.default("completed"),
	stripePaymentIntentId: text(),
	stripeInvoiceId: text(),
	description: text(),
});

export const userOrganization = sqliteTable("user_organization", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
});

export const project = sqliteTable("project", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	name: text().notNull(),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	cachingEnabled: integer({ mode: "boolean" }).notNull().default(false),
	cacheDurationSeconds: integer().notNull().default(60),
	mode: text({
		enum: ["api-keys", "credits", "hybrid"],
	})
		.notNull()
		.default("credits"),
	status: text({
		enum: ["active", "inactive", "deleted"],
	}).default("active"),
});

export const apiKey = sqliteTable("api_key", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	token: text().notNull().unique(),
	description: text().notNull(),
	status: text({
		enum: ["active", "inactive", "deleted"],
	}).default("active"),
	projectId: text()
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
});

export const providerKey = sqliteTable(
	"provider_key",
	{
		id: text().primaryKey().notNull().$defaultFn(shortid),
		createdAt: integer({ mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer({ mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		token: text().notNull(),
		provider: text().notNull(),
		name: text(),
		baseUrl: text(),
		status: text({
			enum: ["active", "inactive", "deleted"],
		}).default("active"),
		organizationId: text()
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
	},
	(table) => ({
		uniqueOrgName: uniqueIndex("unique_org_name").on(
			table.organizationId,
			table.name,
		),
	}),
);

export const log = sqliteTable("log", {
	id: text().primaryKey().notNull().$defaultFn(shortid),
	requestId: text().notNull(),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	projectId: text()
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	apiKeyId: text()
		.notNull()
		.references(() => apiKey.id, { onDelete: "cascade" }),
	duration: integer().notNull(),
	requestedModel: text().notNull(),
	requestedProvider: text(),
	usedModel: text().notNull(),
	usedProvider: text().notNull(),
	responseSize: integer().notNull(),
	content: text(),
	reasoningContent: text(),
	tools: text(), // JSON as text in SQLite
	toolChoice: text(), // JSON as text in SQLite
	finishReason: text(),
	unifiedFinishReason: text(),
	promptTokens: text(),
	completionTokens: text(),
	totalTokens: text(),
	reasoningTokens: text(),
	cachedTokens: text(),
	messages: text(), // JSON as text in SQLite
	temperature: real(),
	maxTokens: integer(),
	topP: real(),
	frequencyPenalty: real(),
	presencePenalty: real(),
	hasError: integer({ mode: "boolean" }).default(false),
	errorDetails: text(), // JSON as text in SQLite
	cost: real(),
	inputCost: real(),
	outputCost: real(),
	cachedInputCost: real(),
	requestCost: real(),
	estimatedCost: integer({ mode: "boolean" }).default(false),
	canceled: integer({ mode: "boolean" }).default(false),
	streamed: integer({ mode: "boolean" }).default(false),
	cached: integer({ mode: "boolean" }).default(false),
	mode: text({
		enum: ["api-keys", "credits", "hybrid"],
	}).notNull(),
	usedMode: text({
		enum: ["api-keys", "credits"],
	}).notNull(),
	source: text(),
});

export const passkey = sqliteTable("passkey", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	name: text(),
	publicKey: text().notNull(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	credentialID: text().notNull(),
	counter: integer().notNull(),
	deviceType: text(),
	backedUp: integer({ mode: "boolean" }),
	transports: text(),
});

export const paymentMethod = sqliteTable("payment_method", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	stripePaymentMethodId: text().notNull(),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text().notNull(),
	isDefault: integer({ mode: "boolean" }).notNull().default(false),
});

export const organizationAction = sqliteTable("organization_action", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	organizationId: text()
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text({
		enum: ["credit", "debit"],
	}).notNull(),
	amount: text().notNull(),
	description: text(),
});

export const lock = sqliteTable("lock", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	key: text().notNull().unique(),
});

export const chat = sqliteTable("chat", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	title: text().notNull(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	model: text().notNull(),
	status: text({
		enum: ["active", "archived", "deleted"],
	}).default("active"),
});

export const message = sqliteTable("message", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	chatId: text()
		.notNull()
		.references(() => chat.id, { onDelete: "cascade" }),
	role: text({
		enum: ["user", "assistant", "system"],
	}).notNull(),
	content: text().notNull(),
	sequence: integer().notNull(),
});

export const installation = sqliteTable("installation", {
	id: text().primaryKey().$defaultFn(shortid),
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	uuid: text().notNull().unique(),
	type: text().notNull(),
});
