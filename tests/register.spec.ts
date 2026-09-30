import { test, expect } from "@playwright/test";
import { uniqueAccount } from "@utils/unique-user";

test("registering through the form creates the account and signs it in", async ({
  page,
}) => {
  const account = uniqueAccount();

  await page.goto("/register");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Email address" }).fill(account.email);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page
      .getByRole("banner", { name: "main navigation" })
      .getByRole("button", { name: account.username }),
  ).toBeVisible();
});
