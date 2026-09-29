import { test, expect } from "@playwright/test";

/**
 * TEMPORARY — remove in the next commit.
 *
 * CI has only ever gone red from a shell command exiting 1 (the readiness gate).
 * A Playwright test has never failed on the runner: npm test has only reported
 * "passed" or been skipped. This proves the other path — test runner exits
 * non-zero, the step fails, the job inherits it — which is what any merge gate
 * actually depends on.
 *
 * Deterministic rather than flaky: a 1ms sleep cannot beat a ~165ms render, so
 * this fails every time instead of most of the time.
 */
test("CI red path: a failing Playwright assertion must fail the job", async ({
  page,
}) => {
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
  await page.waitForTimeout(1);

  const visible = await alert.isVisible();
  expect(visible).toBe(true);
});
