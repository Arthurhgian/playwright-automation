/**
 * Three ways to check the same thing after a click, worst to best.
 *
 * NOT part of the suite. `testDir` is './tests', so nothing here is collected
 * or run. Variant A fails ~90% of the time by design and must never sit in the
 * gate. Kept under `npm run typecheck` (tsconfig includes **\/*.ts).
 *
 * Measured against Vikunja v2.6.0 on 2026-09-29, macOS, 8 logical cores, rate
 * limiter disabled via a scratch compose override. See measure-latency.ts.
 *
 * To run it: copy into tests/ temporarily. Nothing here is meant to stay
 * collected.
 */

import { test, expect } from "@playwright/test";

// Post-click render lands near 160-170ms. N=150 sits just under it, so the
// check usually lands a few ms early. The band is only ~10ms wide, so this
// races only because N is tuned to the millisecond — any environment change
// moves the mean far more than that and pins it to 0% or 100%.
const N = Number(process.env.FLAKE_N ?? 150);

async function submitBadLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Username Or Email Address" })
    .fill("nobody-qa-probe");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("definitely-wrong-1");
  const alert = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: /\S/ });
  await page.getByRole("button", { name: "Login" }).click();
  return alert;
}

// A. Sleep + non-retrying snapshot. isVisible() is an instantaneous boolean and
// expect(boolean) never retries, so the result depends only on whether the
// render beat the timer. ~1-5 of 10 locally.
test("A: sleep + non-retrying snapshot (flake surfaces)", async ({ page }) => {
  const alert = await submitBadLogin(page);
  const t0 = Date.now();
  await page.waitForTimeout(N);
  const afterSleep = Date.now() - t0;
  const visible = await alert.isVisible();
  const afterCheck = Date.now() - t0;
  console.log(
    `PROBE sleep=${afterSleep} check=${afterCheck} visible=${visible}`,
  );
  expect(visible).toBe(true);
});

// B. Sleep + web-first assertion. Passes 10/10, which is the danger: the sleep
// is just as wrong as in A, but expect() re-polls until expect.timeout (5000ms)
// and absorbs the miss. Green is not evidence the wait was correct — it is
// evidence the assertion covered for it. Still pays the sleep on every run.
test("B: sleep + web-first assertion (bug hidden, cost kept)", async ({
  page,
}) => {
  const alert = await submitBadLogin(page);
  await page.waitForTimeout(N);
  await expect(alert).toHaveText("Wrong username or password.");
});

// C. No sleep at all. The web-first assertion already waits — re-querying the
// locator until it matches or expect.timeout expires — so the fixed wait was
// never buying anything. It returns as soon as the alert renders instead of
// sitting out the remainder of N, which makes C faster than B by roughly the
// whole sleep. This is the correct form.
test("C: no sleep + web-first assertion (correct)", async ({ page }) => {
  const alert = await submitBadLogin(page);
  await expect(alert).toHaveText("Wrong username or password.");
});
