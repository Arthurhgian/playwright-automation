import { test, expect } from "@fixtures/login";

// The login page itself is useless as a health signal: with every /api/v1 call
// blocked it renders identically (title, form, links). The failed-login alert is
// different — its text comes from the API's JSON body, so it only appears if the
// frontend's JS runs, the request reaches the API, and the API queries Postgres.
test("login rejects unknown credentials with the API error message", async ({
  loginPage,
}) => {
  await loginPage.signIn("nobody-qa-probe", "definitely-wrong-1");

  await expect(loginPage.formMessage).toHaveText("Wrong username or password.");
});
