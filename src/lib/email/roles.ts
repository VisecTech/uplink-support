/**
 * Role-based email addresses from env, with fallbacks.
 *   EMAIL_SUPPORT — customer-facing support From / Reply-To
 */
export type EmailRole = "support" | "noreply";

export function emailRole(role: EmailRole): string {
	const direct = process.env[`EMAIL_${role.toUpperCase()}`];
	if (direct?.trim()) return direct.trim();
	return process.env.SMTP_FROM ?? `${role}@uplink.net.au`;
}
