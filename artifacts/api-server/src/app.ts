import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const isProduction = process.env.NODE_ENV === "production";

// --- Required configuration -------------------------------------------------
// The server refuses to boot without a real session secret. There is no
// fallback value on purpose: a hardcoded default in a public repository lets
// anyone forge an admin session.
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET is required and must be at least 32 characters. " +
      "Generate one with: openssl rand -base64 48",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required but was not provided.");
}

const app: Express = express();

// Render/Northflank/Fly all sit behind a TLS-terminating proxy. Without this,
// Express sees plain HTTP and refuses to set a `secure` cookie.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// --- CORS -------------------------------------------------------------------
// Only enabled when the frontend is served from a different origin. When the
// API serves the built frontend itself (the default here), same-origin
// requests need no CORS headers at all.
const allowedOrigins = (process.env.APP_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins, credentials: true }));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- Sessions ---------------------------------------------------------------
// Stored in Postgres, not in process memory. Memory-backed sessions log every
// user out on each restart and break entirely across multiple instances.
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

// --- Static frontend --------------------------------------------------------
// The Vite build is copied to dist/client at build time. Serving it from the
// same origin as the API keeps session cookies simple and costs one service
// instead of two.
const clientDir = path.join(import.meta.dirname, "client");

if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir, { index: false, maxAge: "1h" }));

  // SPA fallback for everything that is not an API call.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
} else {
  logger.warn(
    { clientDir },
    "Client build not found; serving API only. Run the frontend build first.",
  );
}

export default app;
