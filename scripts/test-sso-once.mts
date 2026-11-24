// The dashboard's sign-in link is single-use and short-lived; shared secrets compare safely.
//   node --import tsx --test scripts/test-sso-once.mts        (no database needed)
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const { SSO_MAX_AGE_S, ssoFresh, claimSsoOnce, _resetSsoOnce } = await import("../src/lib/auth/sso-once.ts");
const { sameSecret } = await import("../src/lib/auth/shared-secret.ts");

beforeEach(() => _resetSsoOnce());
const NOW = 1_800_000_000_000;
const ts = NOW / 1000;

test("a link is fresh for 30 seconds either side, and not a second more", () => {
	assert.equal(SSO_MAX_AGE_S, 30);
	assert.equal(ssoFresh(ts, NOW), true);
	assert.equal(ssoFresh(ts - 30, NOW), true);
	assert.equal(ssoFresh(ts - 31, NOW), false, "the old two-minute window is gone");
	assert.equal(ssoFresh(ts - 119, NOW), false);
	assert.equal(ssoFresh(ts + 31, NOW), false, "nor one dated in the future");
	assert.equal(ssoFresh(Number.NaN, NOW), false);
});

test("a signature signs in once; the same link again is refused", () => {
	assert.equal(claimSsoOnce("sig-a", ts, NOW), true);
	assert.equal(claimSsoOnce("sig-a", ts, NOW + 1), false);
	assert.equal(claimSsoOnce("sig-a", ts, NOW + 29_000), false, "still refused at the end of the window");
	assert.equal(claimSsoOnce("sig-b", ts, NOW), true, "a different link is its own");
});

test("the list forgets a signature only once the link is too old to pass anyway", () => {
	assert.equal(claimSsoOnce("sig-a", ts, NOW), true);
	const later = NOW + 32_000; // past ts + 30 s + 1 s
	assert.equal(ssoFresh(ts, later), false, "the freshness check refuses it by now");
	assert.equal(claimSsoOnce("sig-a", ts, later), true, "so forgetting it opens nothing");
});

test("a full list refuses new sign-ins, never waves them through", () => {
	for (let i = 0; i < 5000; i++) assert.equal(claimSsoOnce(`s${i}`, ts, NOW), true);
	assert.equal(claimSsoOnce("one-more", ts, NOW), false);
	assert.equal(claimSsoOnce("one-more", ts + 40, NOW + 40_000), true, "and recovers when they expire");
});

test("secrets: equal passes; wrong, shorter, longer, empty and missing all fail without throwing", () => {
	const real = "a".repeat(64);
	assert.equal(sameSecret(real, real), true);
	for (const p of ["b".repeat(64), real.slice(0, 63), real + "a", "", null, undefined, real.toUpperCase()]) {
		assert.equal(sameSecret(p as string | null, real), false, JSON.stringify(p));
	}
	assert.equal(sameSecret(real, ""), false, "an unset secret never matches, even against an empty token");
	assert.equal(sameSecret("", ""), false);
});
