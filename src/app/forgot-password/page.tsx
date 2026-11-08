import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
	return (
		<AuthCard title="Reset your password" subtitle="Enter your staff email and we'll send you a link.">
			<ForgotPasswordForm />
		</AuthCard>
	);
}
