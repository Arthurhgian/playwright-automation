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

**The Vikunja compose file is not in this repository.** This repo contains the test suite only. Copy the block below into `vikunja-sut/docker-compose.yml` (any directory outside this repo works, the name is just the convention used here):

```yaml
services:
  vikunja:
    image: vikunja/vikunja:2.6.0
    environment:
      VIKUNJA_SERVICE_PUBLICURL: http://localhost:3456/
      VIKUNJA_DATABASE_HOST: db
      VIKUNJA_DATABASE_PASSWORD: local-throwaway
      VIKUNJA_DATABASE_TYPE: postgres
      VIKUNJA_DATABASE_USER: vikunja
      VIKUNJA_DATABASE_DATABASE: vikunja
      VIKUNJA_SERVICE_SECRET: REPLACE_ME
    ports:
      - 3456:3456
    volumes:
      - ./files:/app/vikunja/files
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: local-throwaway
      POSTGRES_USER: vikunja
    volumes:
      - ./db:/var/lib/postgresql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h localhost -U $$POSTGRES_USER"]
      interval: 2s
      start_period: 30s
```

Generate your own `VIKUNJA_SERVICE_SECRET` (it signs session tokens — do not commit a real one to a public repo):

```bash
openssl rand -hex 32
```

Then bring it up and wait for it to answer:

```bash
cd vikunja-sut
docker compose up -d
curl -s http://localhost:3456/api/v1/info | head -c 200
```

A JSON body with a `"version"` field means it is ready. Postgres has a 30s `start_period`, so the first boot takes longer than later ones; until the DB passes its healthcheck the API will not be up.

**On versions:** the suite was developed against Vikunja **v2.6.0**, confirmed via `/api/v1/info`. The image tag above is pinned so you get a known build; if you pull an untagged `vikunja/vikunja` instead you get whatever is current, and the login page's accessible names are exactly what the locators depend on. If a locator fails on a fresh pull, check your version against v2.6.0 first.

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
| `tests/` | the suite — everything here is collected and run by `npm test` |
| `notes/` | reasoning, hypotheses, SUT facts; **not** collected by Playwright (`testDir` is `./tests`) |
| `notes/locator-comparison.ts` | five locator strategies ranked against the same element; kept as `.ts` so `tsc` catches API drift |
| `playwright.config.ts` | single chromium project, `BASE_URL`, timeouts, failure artefacts |

`notes/` holds `.ts` files that are never executed but *are* typechecked — `tsconfig.json` includes `**/*.ts`. That is deliberate: sample code that no longer compiles fails `npm run typecheck` instead of rotting quietly.
