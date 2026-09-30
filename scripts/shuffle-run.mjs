// Playwright has no shuffle option, so order is imposed from outside: list every
// test, shuffle with a seeded PRNG, and run them one per invocation, serially.
// Granularity is the individual test, not the file. The SUT's database persists
// across invocations, which is the state an order dependence would live in.
//
//   SEED=12345 node scripts/shuffle-run.mjs     replay a previous order
//   node scripts/shuffle-run.mjs                pick a fresh seed (printed)
import { spawnSync } from "node:child_process";

const seed = Number(process.env.SEED ?? Math.floor(Math.random() * 2 ** 31));

// mulberry32: tiny seeded PRNG so a red run can be replayed exactly.
function rng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const list = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json"], {
  encoding: "utf8",
});
if (list.status !== 0) {
  console.error(list.stdout, list.stderr);
  process.exit(list.status ?? 1);
}

const tests = [];
const walk = (suite) => {
  for (const spec of suite.specs ?? []) tests.push(`${spec.file}:${spec.line}`);
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of JSON.parse(list.stdout).suites) walk(suite);

const next = rng(seed);
for (let i = tests.length - 1; i > 0; i--) {
  const j = Math.floor(next() * (i + 1));
  [tests[i], tests[j]] = [tests[j], tests[i]];
}

console.log(`SEED=${seed}  (${tests.length} tests)`);
tests.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

let failed = 0;
for (const t of tests) {
  const run = spawnSync(
    "npx",
    ["playwright", "test", `tests/${t}`, "--workers=1", "--reporter=list"],
    { stdio: "inherit" },
  );
  if (run.status !== 0) failed++;
}
console.log(failed ? `SHUFFLED RED: ${failed} failed, SEED=${seed}` : `SHUFFLED GREEN, SEED=${seed}`);
process.exit(failed ? 1 : 0);
