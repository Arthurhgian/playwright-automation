import { test, expect } from "@fixtures/user";

test("a signed-in user can add a task to their Inbox", async ({
  page,
  loginPage,
  account,
}) => {
  // Plain on purpose: quick-add strips *labels, +projects, !priority and date
  // words out of titles (notes/vikunja-api.md, section 5).
  const title = `qa task ${account.username}`;

  await loginPage.signIn(account.username, account.password);

  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Inbox", exact: true })
    .click();
  // Not toHaveURL: the URL changes while Overview, with its own "Add a task…"
  // field, is still on screen. The header names the open project only once
  // that project has rendered.
  await expect(
    page
      .getByRole("banner", { name: "main navigation" })
      .getByText("Inbox", { exact: true }),
  ).toBeVisible();

  const newTask = page.getByRole("textbox", { name: "Add a task…" });
  await newTask.fill(title);
  await newTask.press("Enter");

  const task = page
    .getByRole("main")
    .getByRole("link", { name: title, exact: true });
  await expect(task).toBeVisible();

  // The page lists a task as soon as the server answers 201, even one that
  // stored nothing. After a reload the list comes from the server, so this
  // only passes if the task was really saved.
  await page.reload();
  await expect(task).toBeVisible();
});
