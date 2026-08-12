// Shared helpers for the end-to-end suites.
//
// These talk to a running server over HTTP, exactly as the browser does.
// Nothing here reaches into application code: a test that imports the thing
// it is testing cannot catch a wiring mistake, and wiring is where this
// system has broken before (a middleware in the wrong order, a route that
// forgot a filter).

export const BASE = process.env.TEST_API ?? "http://127.0.0.1:5099/api";
export const DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/inv_test";

let passed = 0;
let failed = 0;

export function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

export function section(title) {
  console.log(`\n${title}`);
}

export function report() {
  console.log(`\n=========== ${passed} نجح / ${failed} فشل ===========`);
  return { passed, failed };
}

export async function call(method, path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, data, cookie: res.headers.getSetCookie?.()[0]?.split(";")[0], res };
}

export async function login(username, password = "test1234") {
  const { cookie, status, data } = await call("POST", "/auth/login", { username, password });
  if (!cookie) throw new Error(`login failed for ${username}: ${status} ${JSON.stringify(data)}`);
  return cookie;
}

/** عميل مربوط بجلسة: `const a = api(await login("admin_a"))`. */
export function api(cookie) {
  return (method, path, body) => call(method, path, body, cookie);
}

export const names = (rows) => (Array.isArray(rows) ? rows.map((r) => r.name).sort() : rows);
export const count = (rows) => (Array.isArray(rows) ? rows.length : `not-an-array: ${JSON.stringify(rows)}`);
