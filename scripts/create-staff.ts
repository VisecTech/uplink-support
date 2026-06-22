/**
 * Seed / update a support staff user.
 *   pnpm staff:create -- <email> <name> <role:admin|agent> [password]
 * If password omitted, a random one is generated and printed ONCE.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { support_staff } from "../src/db/schema";

const [email, name, roleArg, pwArg] = process.argv.slice(2);
if (!email || !name) {
	console.error("usage: pnpm staff:create -- <email> <name> <role:admin|agent> [password]");
	process.exit(1);
}
const role = roleArg === "admin" ? "admin" : "agent";
const password = pwArg || randomBytes(9).toString("base64url");

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL not set");
	process.exit(1);
}
const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

async function main() {
	const password_hash = await bcrypt.hash(password, 12);
	const e = email.trim().toLowerCase();
	const [existing] = await db.select().from(support_staff).where(eq(support_staff.email, e)).limit(1);
	if (existing) {
		await db
			.update(support_staff)
			.set({ name, role, password_hash, active: true, deleted_at: null, updated_at: new Date() })
			.where(eq(support_staff.id, existing.id));
		console.log(`[staff] updated ${e} (${role})`);
	} else {
		await db.insert(support_staff).values({ email: e, name, role, password_hash });
		console.log(`[staff] created ${e} (${role})`);
	}
	if (!pwArg) console.log(`[staff] password: ${password}`);
	await sql.end({ timeout: 5 });
	process.exit(0);
}
main();
