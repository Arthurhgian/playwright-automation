/**
 * Five ways to locate the same element, worst to best.
 *
 * NOT part of the suite. `testDir` is './tests', so nothing here is collected
 * or run. It lives outside the suite on purpose: the XPath case below is kept
 * as evidence, and an XPath locator that actually runs in CI is a maintenance
 * liability someone inherits. It stays under `npm run typecheck` (tsconfig
 * includes **\/*.ts), so it cannot rot into code that no longer compiles.
 *
 * Observed against Vikunja v2.6.0 (senior-qa/vikunja-sut) on 2026-09-17.
 * Typecheck proves this still compiles; it does NOT prove the page still
 * looks like this. Treat the DOM claims as true as of that date and version.
 */

import { test, expect } from "@playwright/test";

// 1. XPath — worst. Encodes a path through the document. Says nothing about
//    what the element is for, and breaks when markup moves.
test("finding the element by XPath", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("xpath=//input[@id='username']")).toBeVisible();
});

// 2. CSS — couples to an id/class, which is an implementation detail free to
//    change in a refactor that a user would never notice.
test("finding the element by CSS", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("#username")).toBeVisible();
});

// 3. Text — here it matches the placeholder, which is a hint, not a label.
//    Placeholders get reworded for copy reasons alone.
test("finding the element by text", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("e.g. frederick")).toBeVisible();
});

// 4. Label — what a screen reader announces and what a sighted user reads.
//    Survives markup changes; breaks only if the meaning changes.
test("finding the element by label", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Username Or Email Address")).toBeVisible();
});

// 5. Role + name — best. Asserts the element's purpose (a textbox) and its
//    accessible name together, which is how a user identifies it.
test("finding the element by role", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("textbox", { name: "Username Or Email Address" }),
  ).toBeVisible();
});

/**
 * Why the `name` option is load-bearing, not decoration.
 *
 * Dropping it and probing the count first:
 *
 *   textbox count = 2
 *     [0] id=username type=text     placeholder=e.g. frederick
 *     [1] id=password type=password placeholder=Your password
 *
 * Then asserting on the unqualified locator:
 *
 *   Error: expect(locator).toBeVisible() failed
 *     Locator: getByRole('textbox')
 *     Error: strict mode violation: getByRole('textbox') resolved to 2 elements:
 *         1) <input required type="text" id="username" ...>
 *            aka getByRole('textbox', { name: 'Username Or Email Address' })
 *         2) <input required id="password" type="password" ...>
 *            aka getByRole('textbox', { name: 'Password' })
 *
 * Two things to take from that. The failure is not a timeout and not
 * "not visible" — the username box is visible and would have satisfied
 * toBeVisible() alone. Playwright refused to guess which of the two was meant.
 * That is strict mode working: an ambiguous locator fails at query time instead
 * of silently taking the first match and returning a green tick that means
 * nothing. A `.input` CSS selector matches both too, and nothing makes you
 * notice.
 *
 * And the second match is the surprise: <input type="password"> resolves as
 * role `textbox`. Bare ARIA maps password inputs to no role; Playwright's role
 * computation treats them as textboxes anyway. So "textbox" on a login form is
 * structurally ambiguous, not accidentally so — every login page does this.
 */
