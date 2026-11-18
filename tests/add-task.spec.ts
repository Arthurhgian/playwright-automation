import { test, expect } from "@fixtures/user";

test("a signed-in user can add a task to their Inbox", async ({
  page,
  loginPage,
  account,
}) => {
  const title = `qa task ${account.username}`;

  await loginPage.signIn(account.username, account.password);

  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Inbox", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/\d+\/\d+$/);

  const newTask = page.getByRole("textbox", { name: "Add a task…" });
  await newTask.fill(title);
  await newTask.press("Enter");

  await expect(
    page.getByRole("main").getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
});
