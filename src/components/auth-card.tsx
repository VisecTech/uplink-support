/** The centred card the staff sign-in, forgot-password and reset pages share. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen items-center justify-center px-5">
			<div className="w-full max-w-sm">
				<div className="mb-6 flex items-center justify-center gap-2.5">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/uplink-mark.svg" alt="" width={32} height={32} />
					<span className="text-lg font-semibold tracking-tight">
						Uplink <span className="text-uplink-red-800 dark:text-uplink-red-400">Support</span>
					</span>
				</div>
				<div className="rounded-xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
					<h1 className="mb-1 text-lg font-bold">{title}</h1>
					<p className="mb-5 text-sm text-black/60 dark:text-white/60">{subtitle}</p>
					{children}
				</div>
			</div>
		</div>
	);
}
