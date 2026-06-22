/**
 * KB search box — a plain GET form that navigates to /help/search?q=…
 * (works without JS; SSR results page does the query). Centred, reusable.
 */
export function KbSearch({ defaultValue = "" }: { defaultValue?: string }) {
	return (
		<form action="/help/search" method="get" className="mx-auto flex w-full max-w-xl items-center gap-2">
			<div className="relative flex-1">
				<svg
					aria-hidden="true"
					className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<input
					type="search"
					name="q"
					defaultValue={defaultValue}
					placeholder="Search the help centre…"
					aria-label="Search the help centre"
					autoComplete="off"
					className="w-full rounded-md border border-black/15 bg-white py-2.5 pl-9 pr-3 text-sm text-uplink-ink focus:border-uplink-red-800 focus:outline-none dark:border-white/20 dark:bg-white/5 dark:text-uplink-cream"
				/>
			</div>
			<button
				type="submit"
				className="rounded-md bg-uplink-red-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-uplink-red-900"
			>
				Search
			</button>
		</form>
	);
}
