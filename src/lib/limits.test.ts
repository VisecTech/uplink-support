// pnpm exec tsx src/lib/limits.test.ts   (no test framework in this app)
import { strict as assert } from "node:assert";
import { _chatBudgetReset, chatBudgetTake, DAY_MS } from "./chat-budget";
import { clientIpFromHeaders } from "./client-ip";

const H = (o: Record<string, string>) => new Headers(o);
assert.equal(clientIpFromHeaders(H({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "198.51.100.7" })), "198.51.100.7");
assert.equal(clientIpFromHeaders(H({ "x-forwarded-for": "1.2.3.4" })), null, "X-Forwarded-For alone is never trusted");
assert.equal(clientIpFromHeaders(H({ "x-real-ip": "  " })), null);

_chatBudgetReset();
const t0 = 1_800_000_000_000;
for (let i = 0; i < 5; i++) assert.equal(chatBudgetTake(t0 + i, 5).ok, true);
assert.equal(chatBudgetTake(t0 + 10, 5).ok, false, "the 6th in 24h is refused");
assert.equal(chatBudgetTake(t0 + DAY_MS - 1, 5).ok, false, "still refused just inside the window");
assert.equal(chatBudgetTake(t0 + DAY_MS + 1, 5).ok, true, "drains as the oldest ages out");
assert.equal(chatBudgetTake(t0 + DAY_MS + 1, 5).ok, true, "t0 and t0+1 have both aged out: two slots");
assert.equal(chatBudgetTake(t0 + DAY_MS + 1, 5).ok, false, "and no more than two");
console.log("limits: all pass");
