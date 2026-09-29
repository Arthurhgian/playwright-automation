import { test as base, type Locator } from "@playwright/test";

export interface LoginPage {
  username: Locator;
  password: Locator;
  submit: Locator;
  /**
   * The form also renders an empty field-level alert (#password-error), so this
   * targets the one that actually has text.
   */
  formMessage: Locator;
  signIn(username: string, password: string): Promise<void>;
}

/**
 * Arrives already on /login with the form's locators resolved, so specs state
 * what they assert rather than how to reach the page.
 */
export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    await page.goto("/login");

    const username = page.getByRole("textbox", {
      name: "Username Or Email Address",
    });
    const password = page.getByRole("textbox", { name: "Password" });
    const submit = page.getByRole("button", { name: "Login" });
    const formMessage = page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: /\S/ });

    await use({
      username,
      password,
      submit,
      formMessage,
      async signIn(u, p) {
        await username.fill(u);
        await password.fill(p);
        await submit.click();
      },
    });
  },
});

export { expect } from "@playwright/test";
