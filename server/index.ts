import "dotenv/config";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
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

type AdminIdentity = { id: string; phone: string; role: "ADMIN" };
type TwilioVerifyConfig = { accountSid: string; authToken: string; serviceSid: string };
type AuthOptions = {
  allowedPhones?: string[];
  allowPublicCatalogWrites?: boolean;
  adminUsername?: string;
  adminPassword?: string;
  sendOtp?: (phone: string) => Promise<void>;
  verifyOtp?: (phone: string, code: string) => Promise<boolean>;
};
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

const phoneSchema = z.object({
  phone: z.string().trim().regex(/^(?:\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number."),
}).strict();
const otpSchema = phoneSchema.extend({
  code: z.string().trim().regex(/^\d{4,10}$/, "Enter the OTP sent to your mobile number."),
}).strict();
const passwordLoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
}).strict();
const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(256),
  new_password: z.string().min(12).max(256),
}).strict();
const refreshSchema = z.object({
  refresh_token: z.string().min(40).max(200),
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
const jwtSecret = process.env.JWT_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";
const configuredAllowedPhones = ["+918209305040"];
const configuredAdminUsername = process.env.ADMIN_USERNAME;
const configuredAdminPassword = process.env.ADMIN_PASSWORD;

function assertConfiguration(): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Add your Neon connection string to the private server environment.");
  if (!jwtSecret || jwtSecret.length < 32) throw new Error("JWT_SECRET must contain at least 32 randomly generated characters.");
  const hasUsername = Boolean(configuredAdminUsername);
  const hasPassword = Boolean(configuredAdminPassword);
  if (hasUsername !== hasPassword) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must both be configured for password sign-in.");
  }
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
  if (!hasUsername && !hasTwilio) {
    throw new Error("Configure ADMIN_USERNAME and ADMIN_PASSWORD, or configure all Twilio Verify variables for sign-in.");
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/^\+91/, "");
  return `+91${digits}`;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function credentialsMatch(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`);
    });
  });
}

function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltText, hashText, extra] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra) return Promise.resolve(false);
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  if (salt.length !== 16 || expected.length !== 64) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, expected.length, { N: 16_384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(timingSafeEqual(derivedKey, expected));
    });
  });
}

function createAccessToken(secret: string, phone: string): string {
  return jwt.sign({ phone, role: "ADMIN" }, secret, {
    algorithm: "HS256",
    subject: phone,
    expiresIn: "15m",
    issuer: "jbr-electrical-api",
    audience: "jbr-electrical-admin",
  });
}

function createTwilioVerify(config: TwilioVerifyConfig) {
  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(config.serviceSid)}`;
  const authorization = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;
  const request = async (pathSuffix: string, values: URLSearchParams) => {
    const response = await fetch(`${endpoint}/${pathSuffix}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: values,
    });
    const result = await response.json() as { status?: string; message?: string };
    if (!response.ok) throw new Error(result.message ?? "Twilio Verify request failed.");
    return result;
  };
  return {
    async sendOtp(phone: string) {
      await request("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
    },
    async verifyOtp(phone: string, code: string) {
      const result = await request("VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
      return result.status === "approved";
    },
  };
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
    if (typeof claims === "string" || !claims.sub || typeof claims.phone !== "string" || claims.role !== "ADMIN") {
      publicError(res, 401, "Your admin session is invalid. Please sign in again.");
      return;
    }
    req.admin = { id: claims.sub, phone: claims.phone, role: "ADMIN" };
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

export function createApplication(pool: Pool, secret: string, options: AuthOptions = {}) {
  const allowedPhones = new Set(options.allowedPhones ?? configuredAllowedPhones);
  const adminUsername = options.adminUsername ?? configuredAdminUsername;
  const adminPassword = options.adminPassword ?? configuredAdminPassword;
  const allowPublicCatalogWrites = options.allowPublicCatalogWrites
    ?? process.env.ENABLE_PUBLIC_CATALOG_WRITES === "true";
  const catalogAccess = allowPublicCatalogWrites
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : authenticate(secret);
  const catalogWriteRateLimit = allowPublicCatalogWrites
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    })
    : (_req: Request, _res: Response, next: NextFunction) => next();
  const twilio = options.sendOtp && options.verifyOtp
    ? { sendOtp: options.sendOtp, verifyOtp: options.verifyOtp }
    : createTwilioVerify({
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
      authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
      serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
    });
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
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }), asyncRoute(async (req, res) => {
    const input = passwordLoginSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "Enter a valid username and password.");
      return;
    }
    if (!adminUsername || !adminPassword) {
      publicError(res, 503, "Username and password sign-in is not configured on this API.");
      return;
    }
    const stored = await pool.query<{ username: string; password_hash: string }>(
      "select username, password_hash from admin_credentials where id = 1",
    );
    let credential = stored.rows[0];
    let valid = credential
      ? credentialsMatch(input.data.username, credential.username) && await verifyPassword(input.data.password, credential.password_hash)
      : credentialsMatch(input.data.username, adminUsername) && credentialsMatch(input.data.password, adminPassword);
    if (!valid) {
      publicError(res, 401, "The username or password is incorrect.");
      return;
    }
    if (!credential) {
      const passwordHash = await hashPassword(input.data.password);
      const inserted = await pool.query<{ username: string; password_hash: string }>(
        `insert into admin_credentials (id, username, password_hash)
         values (1, $1, $2)
         on conflict (id) do nothing
         returning username, password_hash`,
        [adminUsername, passwordHash],
      );
      credential = inserted.rows[0];
      if (!credential) {
        const latest = await pool.query<{ username: string; password_hash: string }>(
          "select username, password_hash from admin_credentials where id = 1",
        );
        credential = latest.rows[0];
        valid = Boolean(credential
          && credentialsMatch(input.data.username, credential.username)
          && await verifyPassword(input.data.password, credential.password_hash));
        if (!valid) {
          publicError(res, 401, "The username or password is incorrect.");
          return;
        }
      }
    }
    const phone = [...allowedPhones][0];
    if (!phone) {
      publicError(res, 503, "Administrator sign-in is not configured on this API.");
      return;
    }
    const refreshToken = randomBytes(48).toString("base64url");
    await pool.query(
      "insert into admin_sessions (id, phone, refresh_token_hash) values ($1, $2, $3)",
      [randomUUID(), phone, hashRefreshToken(refreshToken)],
    );
    res.json({
      access_token: createAccessToken(secret, phone),
      refresh_token: refreshToken,
      user: { id: phone, role: "ADMIN" },
    });
  }));

  app.post("/api/auth/password", authenticate(secret), rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }), asyncRoute(async (req, res) => {
    const input = changePasswordSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "The new password must be at least 12 characters.");
      return;
    }
    const stored = await pool.query<{ username: string; password_hash: string }>(
      "select username, password_hash from admin_credentials where id = 1",
    );
    let credential = stored.rows[0];
    let currentPasswordValid = credential
      ? await verifyPassword(input.data.current_password, credential.password_hash)
      : Boolean(adminUsername && adminPassword
        && credentialsMatch(input.data.current_password, adminPassword));
    if (!currentPasswordValid) {
      publicError(res, 401, "The current password is incorrect.");
      return;
    }
    if (!credential) {
      const passwordHash = await hashPassword(input.data.current_password);
      const inserted = await pool.query<{ username: string; password_hash: string }>(
        `insert into admin_credentials (id, username, password_hash)
         values (1, $1, $2)
         on conflict (id) do nothing
         returning username, password_hash`,
        [adminUsername, passwordHash],
      );
      credential = inserted.rows[0];
      if (!credential) {
        const latest = await pool.query<{ username: string; password_hash: string }>(
          "select username, password_hash from admin_credentials where id = 1",
        );
        credential = latest.rows[0];
        currentPasswordValid = Boolean(credential
          && await verifyPassword(input.data.current_password, credential.password_hash));
        if (!currentPasswordValid) {
          publicError(res, 401, "The current password is incorrect.");
          return;
        }
      }
    }
    const nextHash = await hashPassword(input.data.new_password);
    const updated = await pool.query(
      "update admin_credentials set password_hash = $1, updated_at = now() where id = 1 and password_hash = $2 returning id",
      [nextHash, credential?.password_hash],
    );
    if (!updated.rowCount) {
      publicError(res, 409, "The password changed in another session. Sign in again and retry.");
      return;
    }
    await pool.query("update admin_sessions set revoked_at = now() where revoked_at is null");
    res.status(204).end();
  }));

  app.post("/api/auth/otp/start", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }), asyncRoute(async (req, res) => {
    const input = phoneSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "Enter a valid Indian mobile number.");
      return;
    }
    const phone = normalizePhone(input.data.phone);
    if (!allowedPhones.has(phone)) {
      publicError(res, 403, "This mobile number is not authorized for JBR admin access.");
      return;
    }
    try {
      await twilio.sendOtp(phone);
    } catch {
      console.error("Could not send the JBR admin sign-in OTP through Twilio Verify.");
      publicError(res, 502, "Could not send an OTP right now. Please try again later.");
      return;
    }
    res.json({ status: "pending" });
  }));

  app.post("/api/auth/otp/verify", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }), asyncRoute(async (req, res) => {
    const input = otpSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "Enter a valid mobile number and OTP.");
      return;
    }
    const phone = normalizePhone(input.data.phone);
    if (!allowedPhones.has(phone)) {
      publicError(res, 403, "This mobile number is not authorized for JBR admin access.");
      return;
    }
    let approved: boolean;
    try {
      approved = await twilio.verifyOtp(phone, input.data.code);
    } catch {
      console.error("Could not verify the JBR admin sign-in OTP through Twilio Verify.");
      publicError(res, 502, "Could not verify the OTP right now. Please try again later.");
      return;
    }
    if (!approved) {
      publicError(res, 401, "The OTP is incorrect or has expired.");
      return;
    }
    const refreshToken = randomBytes(48).toString("base64url");
    await pool.query(
      "insert into admin_sessions (id, phone, refresh_token_hash) values ($1, $2, $3)",
      [randomUUID(), phone, hashRefreshToken(refreshToken)],
    );
    res.json({
      access_token: createAccessToken(secret, phone),
      refresh_token: refreshToken,
      user: { id: phone, phone, role: "ADMIN" },
    });
  }));

  app.post("/api/auth/refresh", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }), asyncRoute(async (req, res) => {
    const input = refreshSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "Your sign-in session is invalid. Please sign in again.");
      return;
    }
    const nextRefreshToken = randomBytes(48).toString("base64url");
    const result = await pool.query<{ phone: string }>(
      `update admin_sessions
       set refresh_token_hash = $2
       where refresh_token_hash = $1 and revoked_at is null
       returning phone`,
      [hashRefreshToken(input.data.refresh_token), hashRefreshToken(nextRefreshToken)],
    );
    const phone = result.rows[0]?.phone;
    if (!phone || !allowedPhones.has(phone)) {
      publicError(res, 401, "Your sign-in session is invalid. Please sign in again.");
      return;
    }
    res.json({
      access_token: createAccessToken(secret, phone),
      refresh_token: nextRefreshToken,
      user: { id: phone, phone, role: "ADMIN" },
    });
  }));

  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    const input = refreshSchema.safeParse(req.body);
    if (!input.success) {
      publicError(res, 400, "The sign-in session could not be ended.");
      return;
    }
    await pool.query(
      "update admin_sessions set revoked_at = now() where refresh_token_hash = $1 and revoked_at is null",
      [hashRefreshToken(input.data.refresh_token)],
    );
    res.status(204).end();
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

  app.get("/api/admin/products", catalogAccess, asyncRoute(async (_req, res) => {
    const result = await pool.query<ProductRecord>(
      "select id, name, sku, category, description, price, stock, image_url, active, created_at, updated_at from products order by updated_at desc",
    );
    res.json(result.rows.map(productFromRow));
  }));

  app.post("/api/admin/products", catalogAccess, catalogWriteRateLimit, asyncRoute(async (req, res) => {
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

  app.patch("/api/admin/products/:id", catalogAccess, catalogWriteRateLimit, asyncRoute(async (req, res) => {
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

  app.delete("/api/admin/products/:id", catalogAccess, catalogWriteRateLimit, asyncRoute(async (req, res) => {
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
