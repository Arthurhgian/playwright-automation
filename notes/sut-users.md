# Vikunja SUT — which user is which

Recorded 2026-09-16. Source: `docker compose exec -T db psql -U vikunja -d vikunja
-c "select id, username, email, created from users order by id;"` in `senior-qa/vikunja-sut`.

| id | username | created | role |
|---|---|---|---|
| 1 | `arthurhgian` | 2026-09-13 23:51:51 | **test user** — the account the Playwright suite logs in as |
| 2 | `alcooltur` | 2026-09-15 18:06:56 | **SQL sandbox** — scratch account for poking the DB by hand |

Each account's email is a personal address, so it stays out of this file — this repo is
public. `id` and `username` are enough to tell the rows apart; run the query above if you
need the addresses.

**Rule:** specs authenticate as id 1 only. Do hand-written SQL (updates, deletes,
`select` experiments that might mutate) against id 2, so a botched statement can't
silently change what a test asserts on. If a spec ever starts failing on data that
looks wrong rather than code that looks wrong, check whether sandbox work leaked
into id 1's rows.

Local instance only (`localhost:3456`, Docker) — these are not shared credentials,
and the DB is disposable: `vikunja-sut/db` can be recreated from scratch.
