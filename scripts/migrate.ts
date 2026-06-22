/**
 * Apply pending Drizzle SQL migrations against DATABASE_URL (own DB).
 * Mirrors Counter's migrator. Idempotent.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL not set (load via dotenv -e .env.local)");
	process.exit(1);
}

console.log(`[migrate] target: ${url.replace(/:[^@]+@/, ":****@")}`);

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

async function main() {
	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("[migrate] done");
		await sql.end({ timeout: 5 });
		process.exit(0);
	} catch (e) {
		console.error("[migrate] failed:", e instanceof Error ? e.message : String(e));
		await sql.end({ timeout: 5 });
		process.exit(1);
	}
}

main();
