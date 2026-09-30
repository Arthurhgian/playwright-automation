import { expect } from "@playwright/test";
import { uniqueAccount, type Account } from "@utils/unique-user";
import { test as loginTest } from "./login";

/**
 * `account` is a user created for this test alone, through the API rather than
 * the UI: a test about logging in must not depend on the registration form
 * working, and must not depend on another test having registered anyone.
 */
export const test = loginTest.extend<{ account: Account }>({
  account: async ({ request }, use) => {
    const account = uniqueAccount();
    const res = await request.post("/api/v1/register", { data: account });
    expect(res.status(), "registering the test's own user").toBe(200);
    await use(account);
  },
});

export { expect };
