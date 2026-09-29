import { test } from "@playwright/test";

const SAMPLES = 30;

// Click-to-alert latency for a failed login: POST /api/v1/login, the API's
// password check and DB query, then Vue rendering the alert. Fresh context per
// sample, because that is what one test run gets.
test("measure click-to-alert latency", async ({ browser }) => {
  test.setTimeout(300_000);

  const times: number[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();

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

    // Clock starts AFTER click() resolves, because that is where the test's
    // waitForTimeout begins. Timing from before the click would include
    // Playwright's actionability work and overstate the budget.
    await page.getByRole("button", { name: "Login" }).click();
    const t0 = Date.now();
    await alert.waitFor({ state: "visible" });
    times.push(Date.now() - t0);

    await context.close();
  }

  console.log("IN_ORDER " + times.join(","));

  const sorted = [...times].sort((a, b) => a - b);
  const at = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

  const tail = times.slice(Math.floor(times.length / 2));
  const tailSorted = [...tail].sort((a, b) => a - b);
  const tailAt = (p: number): number =>
    tailSorted[Math.min(tailSorted.length - 1, Math.floor(tailSorted.length * p))] ??
    0;

  console.log(
    `ALL     min=${at(0)} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} max=${at(1)}`,
  );
  console.log(
    `TAIL½   min=${tailAt(0)} p25=${tailAt(0.25)} p50=${tailAt(0.5)} p75=${tailAt(0.75)} max=${tailAt(1)}`,
  );
});
