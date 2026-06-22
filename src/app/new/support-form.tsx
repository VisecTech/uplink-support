"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { submitSupportTicketAction } from "./actions";

const FIELD =
	"block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-uplink-ink focus:border-uplink-red-800 focus:outline-none dark:border-white/20 dark:bg-white/5 dark:text-uplink-cream";
const LABEL = "mb-1 block text-xs font-medium text-black/70 dark:text-white/70";
const FIELDSET =
	"space-y-4 rounded-lg border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5";
const LEGEND = "px-2 text-xs uppercase tracking-widest text-black/50 dark:text-white/50";

const PRODUCTS: { value: string; label: string }[] = [
	{ value: "general", label: "General enquiry" },
	{ value: "hosting", label: "Hosting" },
	{ value: "shopkit", label: "Shopkit store" },
	{ value: "sites", label: "Website (WPresskit)" },
	{ value: "clubkit", label: "Clubkit" },
	{ value: "webdev_project", label: "Web project" },
];

const BLOCKED_EXTS = new Set([
	".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".sh", ".ps1", ".jar", ".app", ".dll", ".vbs", ".pif",
]);
const PER_FILE_MAX_MB = 25;
const MAX_FILES = 8;

function fileExt(name: string): string {
	const idx = name.lastIndexOf(".");
	return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}
function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SupportForm({ defaultProduct }: { defaultProduct?: string }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [dragging, setDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	function addFiles(incoming: FileList | File[]) {
		setError(null);
		const next: File[] = [...files];
		for (const f of Array.from(incoming)) {
			if (BLOCKED_EXTS.has(fileExt(f.name))) {
				setError(`"${f.name}" — that file type isn't allowed.`);
				continue;
			}
			if (f.size > PER_FILE_MAX_MB * 1024 * 1024) {
				setError(`"${f.name}" is larger than ${PER_FILE_MAX_MB} MB`);
				continue;
			}
			if (next.find((x) => x.name === f.name && x.size === f.size)) continue;
			if (next.length >= MAX_FILES) {
				setError(`Up to ${MAX_FILES} files per ticket`);
				break;
			}
			next.push(f);
		}
		setFiles(next);
	}

	function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const fd = new FormData(e.currentTarget);
		fd.delete("files");
		for (const f of files) fd.append("files", f);
		startTransition(async () => {
			const r = await submitSupportTicketAction(fd);
			if (!r.ok) {
				setError(r.error);
				return;
			}
			router.push(r.redirect);
		});
	}

	return (
		<form onSubmit={onSubmit} className="space-y-5">
			<fieldset className={FIELDSET}>
				<legend className={LEGEND}>You</legend>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label className={LABEL} htmlFor="name">Your name</label>
						<input id="name" name="name" type="text" className={FIELD} autoComplete="name" />
					</div>
					<div>
						<label className={LABEL} htmlFor="email">Email</label>
						<input id="email" name="email" type="email" required className={FIELD} autoComplete="email" />
					</div>
				</div>
				<div className="hidden" aria-hidden="true">
					<label htmlFor="website">Website (leave blank)</label>
					<input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
				</div>
			</fieldset>

			<fieldset className={FIELDSET}>
				<legend className={LEGEND}>Your request</legend>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label className={LABEL} htmlFor="product_kind">Product</label>
						<select id="product_kind" name="product_kind" defaultValue={defaultProduct ?? "general"} className={FIELD}>
							{PRODUCTS.map((p) => (
								<option key={p.value} value={p.value}>{p.label}</option>
							))}
						</select>
					</div>
					<div>
						<label className={LABEL} htmlFor="subject">Subject</label>
						<input id="subject" name="subject" type="text" required maxLength={300} className={FIELD} placeholder="Short summary" />
					</div>
				</div>
				<div>
					<label className={LABEL} htmlFor="message">How can we help?</label>
					<textarea id="message" name="message" rows={6} required className={FIELD} placeholder="Describe the issue or question — include any error messages, URLs, or steps to reproduce." />
				</div>
			</fieldset>

			<fieldset className={FIELDSET}>
				<legend className={LEGEND}>Attachments (optional)</legend>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
					onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
					onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
					className={`w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
						dragging
							? "border-uplink-red-800 bg-uplink-red-800/5"
							: "border-black/20 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
					}`}
				>
					<p className="text-sm font-medium">
						Drop screenshots or files here, or{" "}
						<span className="text-uplink-red-800 underline dark:text-uplink-red-400">click to choose</span>
					</p>
					<p className="mt-2 text-xs text-black/50 dark:text-white/50">up to {MAX_FILES} files · {PER_FILE_MAX_MB} MB each</p>
				</button>
				<input
					ref={fileInputRef}
					type="file"
					name="files"
					multiple
					onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
					className="hidden"
				/>
				{files.length > 0 && (
					<ul className="space-y-2 text-sm">
						{files.map((f, i) => (
							<li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-black/5 px-3 py-2 dark:bg-white/10">
								<div className="min-w-0 flex-1">
									<div className="truncate font-mono text-xs">{f.name}</div>
									<div className="text-[11px] text-black/50 dark:text-white/50">{formatBytes(f.size)}</div>
								</div>
								<button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="px-2 text-xs text-black/50 hover:text-uplink-red-800 dark:text-white/50">Remove</button>
							</li>
						))}
					</ul>
				)}
			</fieldset>

			<TurnstileWidget />

			{error && (
				<p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">{error}</p>
			)}

			<div className="flex items-center justify-between gap-3 pt-2">
				<p className="text-xs text-black/50 dark:text-white/50">We&apos;ll email you a reference and reply as soon as we can.</p>
				<button type="submit" disabled={pending} className="rounded-md bg-uplink-red-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-uplink-red-900 disabled:opacity-50">
					{pending ? "Sending…" : "Submit request"}
				</button>
			</div>
		</form>
	);
}
