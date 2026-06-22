/**
 * Own database (uplink_support). Lazy postgres-js pool, mirrors Counter's pattern.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
	if (_db) return _db;
	const url = process.env.POOL_DATABASE_URL ?? process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");
	_client = postgres(url, {
		max: Number(process.env.DB_POOL_MAX ?? 6),
		idle_timeout: Number(process.env.DB_POOL_IDLE_TIMEOUT ?? 20),
		connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 10),
		prepare: false,
	});
	_db = drizzle(_client, { schema });
	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_t, prop) {
		return Reflect.get(getDb(), prop, getDb());
	},
});
