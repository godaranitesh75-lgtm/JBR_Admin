import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApplication } from "./index.js";

const secret = "test-secret-value-that-is-at-least-thirty-two-characters-long";
const products = new Map<string, Record<string, unknown>>();
const sessions = new Map<string, string>();
let adminCredential: { username: string; password_hash: string } | undefined;
let sentOtpPhone = "";
const fakePool = {
  async query(sql: string, values: unknown[] = []) {
    if (sql.startsWith("select username, password_hash from admin_credentials")) {
      return { rows: adminCredential ? [{ ...adminCredential }] : [], rowCount: Number(Boolean(adminCredential)) };
    }
    if (sql.startsWith("insert into admin_credentials")) {
      if (adminCredential) return { rows: [], rowCount: 0 };
      adminCredential = { username: String(values[0]), password_hash: String(values[1]) };
      return { rows: [{ ...adminCredential }], rowCount: 1 };
    }
    if (sql.startsWith("update admin_credentials")) {
      if (!adminCredential || adminCredential.password_hash !== String(values[1])) return { rows: [], rowCount: 0 };
      adminCredential = { ...adminCredential, password_hash: String(values[0]) };
      return { rows: [{ id: 1 }], rowCount: 1 };
    }
    if (sql.includes("where revoked_at is null")) {
      const count = sessions.size;
      sessions.clear();
      return { rows: [], rowCount: count };
    }
    if (sql.startsWith("insert into admin_sessions")) {
      sessions.set(String(values[2]), String(values[1]));
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("update admin_sessions") && sql.includes("set refresh_token_hash")) {
      const phone = sessions.get(String(values[0]));
      if (!phone) return { rows: [], rowCount: 0 };
      sessions.delete(String(values[0]));
      sessions.set(String(values[1]), phone);
      return { rows: [{ phone }], rowCount: 1 };
    }
    if (sql.startsWith("update admin_sessions set revoked_at")) {
      const existed = sessions.delete(String(values[0]));
      return { rows: [], rowCount: Number(existed) };
    }
    if (sql.includes("from products where active = true")) {
      return { rows: [...products.values()].filter((product) => product.active === true), rowCount: products.size };
    }
    if (sql.includes("from products order by updated_at desc")) return { rows: [...products.values()], rowCount: products.size };
    if (sql.startsWith("insert into products")) {
      const [name, sku, category, description, price, stock, image_url, active] = values;
      const now = new Date().toISOString();
      const product = { id: randomUUID(), name, sku, category, description, price: String(price), stock, image_url, active, created_at: now, updated_at: now };
      products.set(String(product.id), product);
      return { rows: [product], rowCount: 1 };
    }
    if (sql.startsWith("update products")) {
      const [id, name, sku, category, description, price, stock, image_url, active] = values;
      const current = products.get(String(id));
      if (!current) return { rows: [], rowCount: 0 };
      const product = { ...current, name, sku, category, description, price: String(price), stock, image_url, active, updated_at: new Date().toISOString() };
      products.set(String(id), product);
      return { rows: [product], rowCount: 1 };
    }
    if (sql.startsWith("delete from products")) return { rows: [], rowCount: Number(products.delete(String(values[0]))) };
    return { rows: [{}], rowCount: 1 };
  },
};
const app = createApplication(fakePool as never, secret, {
  adminUsername: "test-admin",
  adminPassword: "test-only-password",
  async sendOtp(phone) {
    sentOtpPhone = phone;
  },
  async verifyOtp(phone, code) {
    return phone === sentOtpPhone && code === "123456";
  },
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;
const publicApp = createApplication(fakePool as never, secret, { allowPublicCatalogWrites: true });
const publicServer = publicApp.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => publicServer.once("listening", resolve));
const publicAddress = publicServer.address() as AddressInfo;
const publicBaseUrl = `http://127.0.0.1:${publicAddress.port}`;

after(async () => {
  await Promise.all([server, publicServer].map((activeServer) => new Promise<void>((resolve, reject) => {
    activeServer.close((error) => error ? reject(error) : resolve());
  })));
});

async function authenticate(): Promise<{ access_token: string; refresh_token: string }> {
  const request = await fetch(`${baseUrl}/api/auth/otp/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "8209305040" }),
  });
  assert.equal(request.status, 200);
  assert.equal(sentOtpPhone, "+918209305040");
  const response = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+918209305040", code: "123456" }),
  });
  assert.equal(response.status, 200);
  return await response.json() as { access_token: string; refresh_token: string };
}

test("authenticates with configured username and password and issues revocable sessions", async () => {
  for (const credentials of [
    { username: "wrong-admin", password: "test-only-password" },
    { username: "test-admin", password: "wrong-password" },
  ]) {
    const denied = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { error: "The username or password is incorrect." });
  }

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-only-password" }),
  });
  assert.equal(response.status, 200);
  const session = await response.json() as { access_token: string; refresh_token: string; user: { role: string } };
  assert.equal(session.user.role, "ADMIN");
  const catalog = await fetch(`${baseUrl}/api/admin/products`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  assert.equal(catalog.status, 200);

  const rejectedChange = await fetch(`${baseUrl}/api/auth/password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: "incorrect-password", new_password: "new-test-password-2026" }),
  });
  assert.equal(rejectedChange.status, 401);

  const changed = await fetch(`${baseUrl}/api/auth/password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: "test-only-password", new_password: "new-test-password-2026" }),
  });
  assert.equal(changed.status, 204);
  assert.equal(sessions.size, 0);

  const oldPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-only-password" }),
  });
  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "new-test-password-2026" }),
  });
  assert.equal(newPasswordLogin.status, 200);
  const newSession = await newPasswordLogin.json() as { refresh_token: string };

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: newSession.refresh_token }),
  });
  assert.equal(logout.status, 204);
});

test("allows only approved mobile numbers and verifies SMS OTP before issuing a session", async () => {
  const denied = await fetch(`${baseUrl}/api/auth/otp/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9000000000" }),
  });
  assert.equal(denied.status, 403);

  const formerAdminNumber = await fetch(`${baseUrl}/api/auth/otp/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9256982263" }),
  });
  assert.equal(formerAdminNumber.status, 403);

  const invalidOtp = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "8209305040", code: "000000" }),
  });
  assert.equal(invalidOtp.status, 401);

  const { access_token: token, refresh_token } = await authenticate();
  const identity = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.deepEqual(await identity.json(), {
    user: { id: "+918209305040", phone: "+918209305040", role: "ADMIN" },
  });
  const refreshed = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh_token }),
  });
  assert.equal(refreshed.status, 200);
  const rotated = await refreshed.json() as { access_token: string; refresh_token: string };
  assert.notEqual(rotated.refresh_token, refresh_token);
  const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  assert.equal(replay.status, 401);
  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rotated.refresh_token }),
  });
  assert.equal(logout.status, 204);
});

test("protects admin inventory endpoints and rejects invalid products", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(unauthorized.status, 401);

  const missingConfiguration = await fetch(`${publicBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test", password: "test" }),
  });
  assert.equal(missingConfiguration.status, 503);

  const { access_token: token } = await authenticate();
  const invalid = await fetch(`${baseUrl}/api/admin/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Invalid switch", category: "Switches", price: -1, stock: -2 }),
  });
  assert.equal(invalid.status, 400);
});

test("public catalog writes are opt-in, validated, and support unauthenticated CRUD", async () => {
  const protectedResponse = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(protectedResponse.status, 401);

  const catalog = await fetch(`${publicBaseUrl}/api/admin/products`);
  assert.equal(catalog.status, 200);
  assert.deepEqual(await catalog.json(), []);

  const invalid = await fetch(`${publicBaseUrl}/api/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Invalid switch", category: "Switches", price: -1, stock: -2 }),
  });
  assert.equal(invalid.status, 400);

  const created = await fetch(`${publicBaseUrl}/api/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Public API test", category: "Testing", price: 12, stock: 3, active: true }),
  });
  assert.equal(created.status, 201);
  const product = await created.json() as { id: string };

  const updated = await fetch(`${publicBaseUrl}/api/admin/products/${product.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Public API test", category: "Testing", price: 12, stock: 4, active: true }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json() as { stock: number }).stock, 4);

  const deleted = await fetch(`${publicBaseUrl}/api/admin/products/${product.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 204);
});

test("limits unauthenticated public catalog writes", async () => {
  const createdIds: string[] = [];
  let limitedStatus = 0;
  for (let requestNumber = 0; requestNumber < 31; requestNumber += 1) {
    const response = await fetch(`${publicBaseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Rate limit test ${requestNumber}`, category: "Testing", price: 1, stock: 1 }),
    });
    if (response.status === 429) {
      limitedStatus = response.status;
      break;
    }
    assert.equal(response.status, 201);
    createdIds.push((await response.json() as { id: string }).id);
  }
  for (const id of createdIds) products.delete(id);
  assert.equal(limitedStatus, 429);
});

test("publishes active products and supports administrator inventory updates", async () => {
  const { access_token: token } = await authenticate();
  const created = await fetch(`${baseUrl}/api/admin/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Camera-ready light", category: "Lighting", price: 249, stock: 8, active: true }),
  });
  assert.equal(created.status, 201);
  const product = await created.json() as { id: string; stock: number; price: number };
  assert.equal(product.stock, 8);
  assert.equal(product.price, 249);

  const update = await fetch(`${baseUrl}/api/admin/products/${product.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Camera-ready light", category: "Lighting", price: 249, stock: 14, active: true }),
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json() as { stock: number }).stock, 14);

  const publicCatalog = await fetch(`${baseUrl}/api/products`);
  assert.equal(publicCatalog.status, 200);
  assert.equal((await publicCatalog.json() as Array<{ id: string }>).some((item) => item.id === product.id), true);

  const deleted = await fetch(`${baseUrl}/api/admin/products/${product.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleted.status, 204);
});

test("allows the live JBR storefront origin to read the public product catalog", async () => {
  const origin = "https://jbr-electrical.vercel.app";
  const response = await fetch(`${baseUrl}/api/products`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
});
