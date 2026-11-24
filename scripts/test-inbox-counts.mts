// The count shown on each inbox tab.   node --import tsx --test scripts/test-inbox-counts.mts
import assert from "node:assert/strict";
import { test } from "node:test";
const { tabCounts, TAB_BADGE, TAB_BADGE_EMPTY } = await import("../src/lib/inbox-counts.ts");

test("each tab counts its own status; unverified skips closed; all is everything", () => {
	const c = tabCounts([
		{ status: "open", n: 2, unverified: 1 },
		{ status: "pending", n: 1, unverified: 0 },
		{ status: "solved", n: 4, unverified: 2 },
		{ status: "closed", n: 66, unverified: 30 },
	]);
	assert.deepEqual(c, { open: 2, pending: 1, on_hold: 0, solved: 4, unverified: 3, all: 73 });
});
test("an empty queue is all zeros, and string counts from the database are added as numbers", () => {
	assert.deepEqual(tabCounts([]), { open: 0, pending: 0, on_hold: 0, solved: 0, unverified: 0, all: 0 });
	const c = tabCounts([{ status: "pending", n: "3" as unknown as number, unverified: "1" as unknown as number }, { status: "pending", n: 2, unverified: 0 }]);
	assert.equal(c.pending, 5); assert.equal(c.unverified, 1);
});
test("every tab but All has a badge style", () => {
	for (const k of ["open", "pending", "on_hold", "solved", "unverified"]) assert.ok(TAB_BADGE[k], k);
	assert.equal(TAB_BADGE.all, null);
});
test("an empty tab has its own faint style, different from every live one", () => {
	assert.ok(TAB_BADGE_EMPTY);
	for (const k of ["open", "pending", "on_hold", "solved", "unverified"]) assert.notEqual(TAB_BADGE[k], TAB_BADGE_EMPTY, k);
});
