# Hypotheses (write down, don't chase)

## H1 — A real outage fails the login spec differently from a simulated one

**Status:** open — scheduled for rung 8.

**Origin (rung 1, 2026-09-15):** `tests/first.spec.ts` was broken on purpose with
`page.route('**/api/v1/login', r => r.abort())`. The alert read `Network Error`.
That simulation happens inside the browser; the containers were untouched.

**Predictions, per real failure:**

| Real failure | Predicted symptom | Why |
|---|---|---|
| `db` container stopped | Alert shows a server error (5xx text), **not** `Network Error` | API is up and answers; it just can't reach Postgres |
| `vikunja` container stopped | `page.goto('/login')` itself fails (`net::ERR_CONNECTION_REFUSED`); the assertion never runs | The same container serves the frontend *and* the API — there is no page to render |
| API slow (not dead) | Passes if the reply lands within 5s `expect` timeout; fails with `Received: ""`-style timeout otherwise | `toHaveText` retries until timeout |

**What would falsify it:** DB-down also shows `Network Error` (would mean the
frontend maps all failures to one message), or the vikunja-down case still
renders a cached page (service worker).

**Method when chased:** `docker compose stop db` → run spec → record the
exact error → `docker compose start db`. Same for `vikunja`. Never on a
shared instance.
