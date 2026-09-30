import { test, expect } from "@fixtures/user";

test("a registered user can log in and lands signed in as themselves", async ({
  page,
  loginPage,
  account,
}) => {
  await loginPage.signIn(account.username, account.password);

  await expect(
    page
      .getByRole("banner", { name: "main navigation" })
      .getByRole("button", { name: account.username }),
  ).toBeVisible();
});
