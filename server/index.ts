import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

type AdminIdentity = { id: string; email: string };
type ProductRecord = QueryResultRow & {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: string | number;
  stock: number;
  image_url: string;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminIdentity;
    }
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
}).strict();

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(60).default(""),
  category: z.string().trim().min(1).max(60),
  description: z.string().max(1000).default(""),
  price: z.coerce.number().finite().min(0).max(9_999_999_999),
  stock: z.coerce.number().int().min(0).max(1_000_000_000),
  image_url: z.string().max(2048).default("").refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Product images must use a secure HTTPS URL."),
  active: z.boolean().default(true),
}).strict();

const idSchema = z.string().uuid();
const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "https://jbr-electrical.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];
const allowedOrigins = new Set([
  ...defaultOrigins,
  ...(process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const jwtSecret = process.env.JWT_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

function assertConfiguration(): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Add your Neon connection string to the private server environment.");
  if (!adminEmail || !z.string().email().safeParse(adminEmail).success) throw new Error("ADMIN_EMAIL must be a valid address for the initial administrator.");
  if (!adminPassword || adminPassword.length < 12 || adminPassword.length > 200) {
    throw new Error("ADMIN_PASSWORD must contain 12 to 200 characters for the initial administrator.");
  }
  if (!jwtSecret || jwtSecret.length < 32) throw new Error("JWT_SECRET must contain at least 32 randomly generated characters.");
}

function productFromRow(row: ProductRecord) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    stock: row.stock,
    image_url: row.image_url,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function validationMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; ");
}

function authenticate(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
  const authorization = req.get("authorization");
  const [scheme, token, extra] = authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token || extra) {
    publicError(res, 401, "Sign in with an administrator account to continue.");
    return;
  }
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "jbr-electrical-api",
      audience: "jbr-electrical-admin",
    });
    if (typeof claims === "string" || !claims.sub || typeof claims.email !== "string") {
      publicError(res, 401, "Your admin session is invalid. Please sign in again.");
      return;
    }
    req.admin = { id: claims.sub, email: claims.email };
    next();
  } catch {
    publicError(res, 401, "Your admin session has expired. Please sign in again.");
  }
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function invalidId(req: Request, res: Response): boolean {
  const parsed = idSchema.safeParse(req.params.id);
  if (parsed.success) return false;
  publicError(res, 400, "This product ID is invalid.");
  return true;
}

export function createApplication(pool: Pool, secret: string) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", isProduction ? 1 : false);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "blob:", "data:", "https:"],
        connectSrc: ["'self'", "https://api.cloudinary.com"],
      },
    },
  }));
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "32kb", strict: true }));
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }));

  app.get("/api/health", asyncRoute(async (_req, res) => {
    await pool.query("select 1");
    res.json({ status: "ok", database: "connected" });
  }));

  app.post("/api/auth/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
  }), asyncRoute(async (req, res) => {
    const input = credentialsSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "Enter a valid admin email address and password.");
      return;
    }
    const result = await pool.query<Pick<ProductRecord, "id"> & { email: string; password_hash: string }>(
      "select id, email, password_hash from admin_users where email = $1",
      [input.data.email],
    );
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(input.data.password, admin.password_hash))) {
      publicError(res, 401, "The email address or password is incorrect.");
      return;
    }
    const accessToken = jwt.sign({ email: admin.email }, secret, {
      algorithm: "HS256",
      subject: admin.id,
      expiresIn: "8h",
      issuer: "jbr-electrical-api",
      audience: "jbr-electrical-admin",
    });
    res.json({ access_token: accessToken, user: { id: admin.id, email: admin.email } });
  }));

  app.get("/api/auth/me", authenticate(secret), (req, res) => {
    res.json({ user: req.admin });
  });

  app.get("/api/products", asyncRoute(async (_req, res) => {
    const result = await pool.query<ProductRecord>(
      "select id, name, sku, category, description, price, stock, image_url, active, created_at, updated_at from products where active = true order by name asc",
    );
    res.json(result.rows.map(productFromRow));
  }));

  app.get("/api/admin/products", authenticate(secret), asyncRoute(async (_req, res) => {
    const result = await pool.query<ProductRecord>(
      "select id, name, sku, category, description, price, stock, image_url, active, created_at, updated_at from products order by updated_at desc",
    );
    res.json(result.rows.map(productFromRow));
  }));

  app.post("/api/admin/products", authenticate(secret), asyncRoute(async (req, res) => {
    const input = productSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, validationMessage(input.error));
      return;
    }
    const product = input.data;
    const result = await pool.query<ProductRecord>(
      `insert into products (name, sku, category, description, price, stock, image_url, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, name, sku, category, description, price, stock, image_url, active, created_at, updated_at`,
      [product.name, product.sku, product.category, product.description, product.price, product.stock, product.image_url, product.active],
    );
    res.status(201).json(productFromRow(result.rows[0]));
  }));

  app.patch("/api/admin/products/:id", authenticate(secret), asyncRoute(async (req, res) => {
    if (invalidId(req, res)) return;
    const input = productSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, validationMessage(input.error));
      return;
    }
    const product = input.data;
    const result = await pool.query<ProductRecord>(
      `update products
       set name = $2, sku = $3, category = $4, description = $5, price = $6, stock = $7, image_url = $8, active = $9, updated_at = now()
       where id = $1
       returning id, name, sku, category, description, price, stock, image_url, active, created_at, updated_at`,
      [req.params.id, product.name, product.sku, product.category, product.description, product.price, product.stock, product.image_url, product.active],
    );
    if (!result.rowCount) {
      publicError(res, 404, "This product no longer exists.");
      return;
    }
    res.json(productFromRow(result.rows[0]));
  }));

  app.delete("/api/admin/products/:id", authenticate(secret), asyncRoute(async (req, res) => {
    if (invalidId(req, res)) return;
    const result = await pool.query("delete from products where id = $1", [req.params.id]);
    if (!result.rowCount) {
      publicError(res, 404, "This product no longer exists.");
      return;
    }
    res.status(204).end();
  }));

  app.use("/api", (_req, res) => publicError(res, 404, "This API route does not exist."));

  if (isProduction) {
    app.use(express.static(webDirectory, {
      index: false,
      maxAge: "1d",
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
    app.get("*splat", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(webDirectory, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    console.error("JBR Electrical API request failed:", message);
    if (res.headersSent) return;
    if (error instanceof SyntaxError) {
      publicError(res, 400, "The request body contains invalid JSON.");
      return;
    }
    publicError(res, 500, "The server could not complete this request. Please try again.");
  };
  app.use(errorHandler);

  return app;
}

async function start(): Promise<void> {
  assertConfiguration();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) => console.error("An idle Neon connection failed:", error.message));

  try {
    await pool.query("select 1");
    const passwordHash = await bcrypt.hash(adminPassword!, 12);
    await pool.query(
      "insert into admin_users (email, password_hash) values ($1, $2) on conflict (email) do nothing",
      [adminEmail, passwordHash],
    );
    const app = createApplication(pool, jwtSecret!);
    const port = Number(process.env.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port number.");
    const server = app.listen(port, "0.0.0.0", () => {
      console.info(`JBR Electrical API listening on port ${port}.`);
    });
    const shutdown = (signal: string) => {
      console.info(`${signal} received; closing the JBR Electrical API.`);
      server.close((error) => {
        void pool.end().then(() => {
          if (error) {
            console.error("Could not close the HTTP server cleanly:", error.message);
            process.exitCode = 1;
          }
        });
      });
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    await pool.end();
    throw error;
  }
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  void start().catch((error: unknown) => {
    console.error("JBR Electrical API could not start:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
