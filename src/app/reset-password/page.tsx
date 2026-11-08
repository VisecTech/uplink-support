import { AuthCard } from "@/components/auth-card";
import { isResetTokenValid, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./form";

export const dynamic = "force-dynamic";
// ⚠ no-referrer: the token is in this page's URL, and must not leak to any
// third-party request the page makes.
export const metadata = { title: "Set a new password", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const { token = "" } = await searchParams;
	const valid = await isResetTokenValid(token);
	if (!valid) {
		return (
			<AuthCard title="Link expired" subtitle="This reset link is invalid, already used, or older than 30 minutes.">
				<a
					href="/forgot-password"
					className="block w-full rounded-md bg-uplink-red-800 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-uplink-red-900"
				>
					Send a new link
				</a>
			</AuthCard>
		);
	}
	return (
		<AuthCard title="Set a new password" subtitle="Choose a new password for your staff login.">
			<ResetPasswordForm token={token} minLength={MIN_PASSWORD_LENGTH} />
		</AuthCard>
	);
}
