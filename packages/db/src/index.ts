import * as schema from "./schema";

export * from "./db.d1";
export * from "./schema";
export * from "./types";
export * from "./migrate";
export { db } from "./db";

export * from "drizzle-orm";

export const tables = {
	...schema,
};
