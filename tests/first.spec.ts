import { test, expect } from '@playwright/test';

// The login page itself is useless as a health signal: with every /api/v1 call
// blocked it renders identically (title, form, links). The failed-login alert is
// different — its text comes from the API's JSON body, so it only appears if the
// frontend's JS runs, the request reaches the API, and the API queries Postgres.
test('login rejects unknown credentials with the API error message', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'Username Or Email Address' }).fill('nobody-qa-probe');
  await page.getByRole('textbox', { name: 'Password' }).fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Login' }).click();

  // The form also has an empty field-level alert (#password-error); target the one with text.
  const formMessage = page.getByRole('main').getByRole('alert').filter({ hasText: /\S/ });
  await expect(formMessage).toHaveText('Wrong username or password.');
});
