/**
 * Private-uploads root — files NOT served by nginx (support attachments are
 * downloadable only by authenticated staff via a streaming route in Stage 2).
 * Uses SUPPORT_PRIVATE_UPLOADS, else handles the .next/standalone cwd offset.
 */
import { resolve } from "node:path";

export function privateUploadRoot(): string {
	const override = process.env.SUPPORT_PRIVATE_UPLOADS;
	if (override) return override;
	const cwd = process.cwd();
	if (cwd.endsWith("/.next/standalone")) return resolve(cwd, "../../private-uploads");
	return resolve(cwd, "private-uploads");
}

/** Strip path separators + metacharacters; preserve a recognisable name. */
export function sanitiseFilename(name: string): string {
	const base = name.replace(/[/\\]/g, "_");
	const stripped = base
		.replace(/\.\./g, "_")
		.replace(/[^\w\-. ]/g, "_")
		.replace(/\s+/g, " ")
		.trim();
	const truncated = stripped.length > 200 ? stripped.slice(-200) : stripped;
	return truncated || "upload";
}
