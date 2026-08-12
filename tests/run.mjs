// Runs every suite against a running server, reseeding before each one.
//
// Reseeding between suites is not tidiness: the suites create and delete rows,
// and a suite that asserts on exact contents would fail on the leftovers of
// the one before it — a failure that says nothing about the code.

import { report } from "./lib.mjs";
import { seed } from "./seed.mjs";

const SUITES = [
  ["isolation", () => import("./isolation.test.mjs")],
  ["switching", () => import("./switching.test.mjs")],
  ["numbering", () => import("./numbering.test.mjs")],
  ["signup", () => import("./signup.test.mjs")],
  ["company-admin", () => import("./company-admin.test.mjs")],
  ["quotations", () => import("./quotations.test.mjs")],
  ["invoice-approval", () => import("./invoice-approval.test.mjs")],
];

const only = process.argv[2];

for (const [name, load] of SUITES) {
  if (only && name !== only) continue;

  console.log(`\n${"─".repeat(60)}\n  ${name}\n${"─".repeat(60)}`);
  await seed();
  const suite = await load();
  await suite.default();
}

const { failed } = report();
process.exit(failed > 0 ? 1 : 0);
