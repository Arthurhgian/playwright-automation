# playwright-expert

Playwright + TypeScript UI automation, built in staged "rungs" against a real system under test. Part of the 92-day PDI sprint.

The system under test is [Vikunja](https://vikunja.io), an open-source task manager, run locally in Docker. The specs drive it through a real browser against a real Postgres — no mocked API, no stubbed network. Each rung has a Build / Concept / Out loud / Done-when, and the goal is explained behaviour rather than green ticks: every assertion here is meant to be one you can say out loud *why* it fails when it fails. `notes/` carries the reasoning that doesn't belong in test code — locator rankings, SUT account rules, open hypotheses.

## Prerequisites

Verified on the versions in the right-hand column. Other versions probably work; these are the ones this was actually built and run against.

| | Required | Built against |
|---|---|---|
| Node | >= 20 (`@playwright/test` declares `node >=20`) | v20.12.2 |
| npm | ships with Node | 10.5.0 |
| Docker | any recent version with Compose v2 | 29.7.2 |

Check yours:

```bash
node -v && npm -v && docker --version
```

## 1. Start the system under test

The compose file is in this repository at `sut/docker-compose.yml` — you don't need to find Vikunja or write one yourself. From the repo root:

```bash
docker compose -f sut/docker-compose.yml up -d
```

Then wait for it to answer. Poll, don't sleep: Postgres has a 30s `start_period` and Vikunja won't start until the database passes its healthcheck, so how long this takes varies.

```bash
for i in $(seq 45); do curl -sf http://localhost:3456/api/v1/info >/dev/null && echo READY && break; sleep 2; done
curl -s http://localhost:3456/api/v1/info | head -c 120
```

`READY` plus a body containing `"version":"v2.6.0"` means you can run the suite. If `READY` never prints, run `docker compose -f sut/docker-compose.yml ps -a` — a container sitting in `Exited` or `Restarting` is the answer, and `docker compose -f sut/docker-compose.yml logs vikunja` will say why.

To wipe everything and start from an empty database:

```bash
docker compose -f sut/docker-compose.yml down -v
```

**Two things in that file look odd and are deliberate.** File storage points at `/tmp/vikunja-files` via `VIKUNJA_FILES_BASEPATH`, because Vikunja runs as uid 1000 and cannot write to `/app/vikunja`; the conventional bind-mounted `./files` only appears to work on macOS, where Docker Desktop maps host ownership permissively, and fails on Linux. And neither service sets a `restart:` policy, so a crash surfaces immediately as `Exited (1)` rather than hiding behind a restart loop that is indistinguishable from "still booting" to any readiness check.

`VIKUNJA_SERVICE_SECRET` has a throwaway default so the stack runs with no setup. It signs session tokens, so for anything less disposable than a local test instance, override it:

```bash
VIKUNJA_SERVICE_SECRET=$(openssl rand -hex 32) docker compose -f sut/docker-compose.yml up -d
```

**On versions:** the suite was developed against Vikunja **v2.6.0**, confirmed via `/api/v1/info`, and the image is pinned to that tag in the compose file. The login page's accessible names are exactly what the locators depend on, so if a locator fails, check your version first.


## 2. Install the project

Two steps. The second is separate and easy to forget — npm installs the Playwright *library*, not the browser binaries it drives.

```bash
npm ci
npx playwright install chromium
```

Only Chromium is needed; `playwright.config.ts` defines a single `chromium` project.

## 3. Run the tests

```bash
npm test              # run the suite
npm run test:headed   # same, with a visible browser
npm run test:ui       # Playwright's interactive UI mode
npm run typecheck     # tsc --noEmit, no tests run
npm run report        # open the HTML report from the last run
```

If your Vikunja is not on `http://localhost:3456`, override the base URL with **`BASE_URL`**:

```bash
BASE_URL=http://localhost:8080 npm test
```

Specs navigate with relative paths (`page.goto('/login')`), so `BASE_URL` is the single place the host is configured.

## 4. What a correct run looks like

```
Running 1 test using 1 worker

  ✓  1 [chromium] › tests/first.spec.ts:7:5 › login rejects unknown credentials with the API error message (1.2s)

  1 passed (3.9s)
```

One test, one file, passing. `npm run typecheck` prints nothing and exits 0.

"It ran" and "it worked" are different things, and this suite is built so you can tell them apart. The single spec deliberately does *not* assert on the login page rendering — with every `/api/v1` call blocked the page renders identically. It asserts on the failed-login alert text, which comes from the API's JSON body, so it can only appear if the frontend's JS runs, the request reaches the API, and the API queries Postgres. A pass means the whole stack answered. See the comment at the top of [tests/first.spec.ts](tests/first.spec.ts).

On failure you get a trace, screenshot and video under `test-results/` (`trace: 'retain-on-failure'`), openable with:

```bash
npx playwright show-trace test-results/<dir>/trace.zip
```

## 5. Accounts — read this before you register anything

**The current suite needs no account, and a fresh empty Vikunja is the correct state for it.**

The only collected spec logs in with credentials that are meant to fail (`nobody-qa-probe` / `definitely-wrong-1`) and asserts Vikunja's rejection message. It depends on that username **not existing**. So the hazard runs backwards from the usual one: registering a user called `nobody-qa-probe` on your instance is what would turn this suite red. Register any other name you like.

Later rungs add specs that authenticate as a real user. When they do, `notes/sut-users.md` records which account the suite owns versus which is the scratch account for hand-written SQL, and why the two are kept apart.

## Repository layout

| Path | |
|---|---|
| `sut/` | the system under test — Vikunja + Postgres compose file, image pinned to v2.6.0 |
| `tests/` | the suite — everything here is collected and run by `npm test` |
| `notes/` | reasoning, hypotheses, SUT facts; **not** collected by Playwright (`testDir` is `./tests`) |
| `notes/locator-comparison.ts` | five locator strategies ranked against the same element; kept as `.ts` so `tsc` catches API drift |
| `playwright.config.ts` | single chromium project, `BASE_URL`, timeouts, failure artefacts |

`notes/` holds `.ts` files that are never executed but *are* typechecked — `tsconfig.json` includes `**/*.ts`. That is deliberate: sample code that no longer compiles fails `npm run typecheck` instead of rotting quietly.
