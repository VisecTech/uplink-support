import { KbEditor } from "../kb-editor";

export const dynamic = "force-dynamic";

export default function NewKbArticlePage() {
	return (
		<div className="space-y-5">
			<h1 className="text-lg font-bold">New article</h1>
			<KbEditor />
		</div>
	);
}
