# Vikunja API: authentication, projects, and what a saved sign-in holds

Recorded 2026-11-18 against the local SUT (`vikunja/vikunja:2.6.0`, `localhost:3456`).
Each claim is tagged with its source:

- **doc**: <https://vikunja.io/docs/api-documentation/>
- **spec**: the instance's own OpenAPI file, `GET /api/v1/docs.json`
- **observed**: a request made against the SUT (curl, or a throwaway Playwright probe
  outside the suite) with a disposable `qa_probe…` user

The doc page only covers authentication. Everything about projects and registration
comes from the spec and from observed requests.

## 1. Authenticating a request as a user

Every authenticated request sends `Authorization: Bearer <token>` (doc). The spec calls
this `JWTKeyAuth` and requires it on `/projects` and `/user`. The token alone decides
which user the request acts as.

There are two ways to get a token (doc):

| Way | How | Notes |
|---|---|---|
| API token | Create one under Settings > API Tokens in the web UI | The doc recommends this. It's the only way on Vikunja Cloud. |
| Password login | `POST /api/v1/login` with `{username, password}` | Self-hosted only. Returns `{"token": "<JWT>"}`. |

Observed with a token from `/login`:

| Request | Result |
|---|---|
| `GET /projects`, no header | **401**, `code 11`, "missing, malformed, expired or otherwise invalid token provided" |
| `GET /projects`, `Bearer <JWT>` | **200**, that user's projects |

### What `/login` actually returns (observed)

- **Body:** `{"token": "<JWT>"}`. The JWT claims are `id`, `username`, `exp`, `sid`
  (session id), `jti`, `type`, `is_admin`. **TTL is 600 s (10 min).**
- **Cookies:** two `Set-Cookie: vikunja_refresh_token=…` headers with the same value, one
  per API version:
  - `Path=/api/v1/user/token/refresh` and `Path=/api/v2/user/token/refresh`
  - `HttpOnly; SameSite=Lax; Max-Age=259200` (3 days)

### Refreshing the JWT (spec + observed)

`POST /api/v1/user/token/refresh` "exchanges the refresh token cookie for a new
short-lived JWT" (spec). Observed behaviour:

| Call | Result |
|---|---|
| With the cookie from `/login` | **200**, new JWT, **and a new cookie** (the token rotates) |
| Same original cookie again | **401**, `code 16002`, "Invalid or expired refresh token." |
| With the rotated cookie | **200**. Replaying the old cookie did not revoke the newer one. |
| No cookie | **401**, "No refresh token provided." |

So a refresh cookie works once. Its responses carry `X-Ratelimit-Limit: 60`.

## 2. Creating a project

`PUT /api/v1/projects` (PUT, not POST) with a Bearer token (spec). `parent_project_id` is
optional, and setting it needs write access to that parent.

| Body | Result (observed) |
|---|---|
| `{}` | **412**, `code 2002`, `invalid_fields: ["title: non zero value required"]` |
| `{"title": "probe"}` | **201 Created** (not 200) with the project, which has List/Gantt/Table/Kanban views |

`title` is the only required field.

### A freshly registered user already has projects (observed)

Straight after `POST /register`, `GET /projects` returns two entries:

| Entry | id | What it is |
|---|---|---|
| `Inbox` | positive (a real row) | A real project the user owns, created at registration, with all four views |
| `My Open Tasks` | **negative** (e.g. `-50`) | A saved filter shown as a pseudo-project, not a real project |

A spec can't assume a new user has zero projects. Count `id > 0`, or allow for both
entries.

## 3. What the frontend keeps after a UI sign-in

From the served bundle, `/assets/*.js` (the token helpers):

- The JWT is kept in memory and written to **`localStorage["token"]`** only when the login
  is persisted. Password and OpenID logins call it with `persist = true`. Link-share logins
  call it with `false`, so their token lives in memory only.
- On logout the frontend removes `token` (and `desktopOAuthRefreshToken`) from
  `localStorage`.
- Nothing session-related goes into `sessionStorage`, and the frontend never sets the
  refresh cookie itself (the API sets it, HttpOnly).
- The frontend calls `user/token/refresh` on every page load, then again before `exp`.

Observed with a Playwright probe (`context.storageState()` after a UI sign-in):

- **cookies:** the two `vikunja_refresh_token` cookies (HttpOnly, both paths, 3 days)
- **localStorage** (`http://localhost:3456`): `token`, plus UI preferences
  (`API_URL`, `menuActiveDesktopPreference`, `navigation-child-projects-open`,
  `hideAddToHomeScreenMessage`)

## 4. Replaying a saved state (observed)

One saved file, loaded into new contexts:

| Case | Signed in? | Refresh calls on load |
|---|---|---|
| UI state, 1st load | yes | `[200]`, which spends the saved cookie |
| Same file, 2nd and 3rd load (JWT still < 10 min old) | yes | `[401 ×4]`, kept alive by the still-valid JWT |
| Built from API login: `request.storageState()` + `localStorage.token` set by hand | yes | `[200]` |
| `localStorage.token` only, no cookie (JWT fresh) | yes | `[401 ×4]` |
| Refresh cookie only, no `localStorage.token` | **no**, redirected to `/login` | none, the frontend doesn't even try |
| Spent cookie, **JWT expired** (t+630 s) | **no**, `/login` | `[401 ×8]` |
| Unused cookie, **JWT expired** (t+630 s) | yes | `[200, 200]` |

### What follows for replacing the UI sign-in

1. **What gets replayed is the JWT in `localStorage["token"]`.** The refresh cookie only
   renews it, and without the `localStorage` entry the frontend treats you as signed out.
2. **`storageState` captures both:** cookies (HttpOnly included) and `localStorage`. It
   doesn't capture `sessionStorage`, but Vikunja doesn't use it for the session.
3. **A saved file is reusable for about 10 minutes, then single-use.** Any number of
   contexts can load it while its JWT is valid. After that, a context gets in only if the
   file's refresh cookie is still unused, and the first page load always spends it. A
   setup project that writes one file and shares it across a run that lasts more than
   10 minutes will send later tests to `/login`.
4. **The UI isn't needed to produce the state.** `POST /api/v1/login` through
   `APIRequestContext`, then `request.storageState()` for the cookie plus an `origins`
   entry with `{ name: "token", value: <JWT> }`, signs the browser in. Minting this per
   test (or per worker) avoids sharing a refresh cookie.
5. **Loads with a spent cookie are noisy:** 4 failed refresh calls per load, 8 once the
   JWT has expired. Expect them in traces, and don't write network assertions that forbid
   401s.

The commit that added `login-success` and `register` records that Vikunja allows only 10
unauthenticated requests per 60 s per IP, so each API login spends part of that budget.
The refresh endpoint reports its own `X-Ratelimit-Limit: 60`.

## 5. Adding a task to the Inbox through the UI (observed)

From a Playwright probe and a manual `codegen` session.

### Getting there

- Signing in lands on `/` (Overview), not the Inbox. Overview has its own "Add a task…"
  field, so a task typed there proves nothing about the Inbox.
- The Inbox is reached from the sidebar: navigation "Projects" → link "Inbox". The URL
  becomes `/projects/<projectId>/<viewId>`, where the view is List. Both ids are
  different for every user, so a spec clicks its way there instead of calling `goto` with
  a hardcoded id.
- The route changes on the client. Wait for the URL (`toHaveURL`) before typing, or
  `fill()` can land in Overview's field just as it is replaced.

### Saving

Enter in "Add a task…" sends `POST /api/v2/projects/<projectId>/tasks/bulk` and gets back
**201** with `{"tasks": [ … ]}`.

### Quick-add magic rewrites the title

| Typed (plus a unique suffix) | Stored title | What else happened |
|---|---|---|
| `plain` | `plain` | nothing |
| `call bob tomorrow` | `call bob ` (double space before the suffix) | due date set to tomorrow |
| `review *urgent` | `review` | label `urgent` created and shown on the task |
| `ship !3` | `ship` | priority 3, shown as "High" |
| `move +Inbox` | `move` | project set to Inbox |
| `ends with friday` | `ends with ` (double space) | due date set to Friday |
| `hex a1dec3f9`, `hex 3feb9c21` | unchanged | hex containing `dec` / `feb` isn't read as a month |

Keep test titles plain. An exact-match assertion on the title also checks that nothing
was parsed out of it.

### Where the title shows up

Only in `<main>`'s task list, under two accessible names: the link `<title>` and the
checkbox `Mark '<title>' as done`. No toast appears: the DOM was watched for 5 s after
saving. A link locator scoped to `main` with `exact: true` matches exactly one element.
