# playwright-expert

Playwright + TypeScript UI automation, build in staged "rungs" against a real system under test. Part of the 92-day PDI sprint

Each rung has a Build / Concept / Out loud / Done-when. The goal is explained behaviour, not green ticks.

## System under test

Vikunja v2.6.0, run locally from `../vikunja-sut/docker-compose.yml`. 

| | |
|---|---|
| URL | http://localhost:3456 |
| Stack | Vikunja + Postgres 18, Docker Compose |
| State | Persisted in `../vikunja-sut/db` and `../vikunja-sut/files` |

The SUT is local-only and holds throwaway data. Credentials live in the compose file; nothing there is a real secret. 

## Setup

```bash
npm ci
npx playwright install chromium 

Start the SUT before running tests: 

cd ../vikunja-sut && docker compose up -d

Wait for http://localhost:3456 to answer, then create an account through the UI on first run. Vikunja starts with an empty database.