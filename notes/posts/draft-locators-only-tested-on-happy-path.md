# Your locators have only ever seen the happy path

*Draft — not published.*

I wrote a Playwright test this morning that passed on three browsers. It was also
broken, and nothing about the green tick told me.

## The test

Against a local Vikunja instance: open `/login`, submit a username that doesn't
exist, assert the error alert says `Wrong username or password.`

I picked that assertion on purpose. I'd first checked whether the login page
could tell me anything at all about app health — blocked every `/api/v1` request
and reloaded. The page rendered identically: title, form, links. Anything visual
on that page passes with the backend dead. The failed-login message is different:
its text comes from the API's JSON body, so it only appears if the frontend sends
the request, the API answers, and the API queried Postgres.

```ts
await expect(page.getByRole('main').getByRole('alert'))
  .toHaveText('Wrong username or password.');
```

Green on Chromium, Firefox, WebKit.

## Breaking it

A test you've never seen fail is a test you haven't verified, so I killed the
login request (`page.route(..., r => r.abort())`) and expected:

```
Expected: "Wrong username or password."
Received: "Network Error"
```

What I got:

```
Error: strict mode violation: getByRole('main').getByRole('alert') resolved to 2 elements:
  1) <div role="alert" class="message-wrapper">…  aka getByRole('alert').filter({ hasText: 'Network Error' })
  2) <p role="alert" id="password-error" class="help is-danger"></p>
```

The form has a second, empty `role="alert"` for field validation. On the happy
path it's gone by the time the server message renders, so the loose locator
happened to resolve to one element. On the error path both exist at once. The
backend was down, and my report blamed **my locator**.

In hindsight the passing run had warned me. Its call log, visible only when
I'd deliberately failed the text, said `3 × locator resolved to <p … id="password-error">`
before landing on the right element. Retrying had papered over it.

## The fix

```ts
const formMessage = page.getByRole('main').getByRole('alert').filter({ hasText: /\S/ });
await expect(formMessage).toHaveText('Wrong username or password.');
```

Same outage, now:

```
Locator:  getByRole('main').getByRole('alert').filter({ hasText: /\S/ })
Expected: "Wrong username or password."
Received: "Network Error"
```

That's a report someone can act on at 3am.

## The part that generalizes

A locator is only exercised against the DOM states your test actually reaches.
Passing tests reach one state: the happy one. Failure states render *extra*
elements — error banners, field errors, retry buttons, empty states — and those
are exactly when you need the report to be precise.

So a green test tells you the locator is unambiguous *when nothing is wrong*.
It says nothing about the only moment the test matters.

What I do now:

1. **Break the app, not just the assertion.** Changing the expected string tests
   your error message. Aborting a route tests your locator.
2. **Read the call log of a failure, even a deliberate one.** `N × resolved to`
   lines that name an element you didn't mean are a latent strict-mode violation.
3. **Ask "what else has this role on the error path?"** before trusting a
   role-only locator for alerts, dialogs, and status regions.

<!-- TODO before publishing: screenshot of both failure outputs; decide whether
     hasText:/\S/ is the right long-term locator or a stepping stone to a test id. -->
