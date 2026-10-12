import bcrypt from "bcryptjs";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApplication } from "./index.js";

const secret = "test-secret-value-that-is-at-least-thirty-two-characters-long";
const password = "test-admin-password-long-enough";
const account = { id: randomUUID(), email: "owner@example.com", password_hash: await bcrypt.hash(password, 4) };
const products = new Map<string, Record<string, unknown>>();
const fakePool = {
  async query(sql: string, values: unknown[] = []) {
    if (sql.includes("from admin_users where email = $1")) return { rows: [account], rowCount: 1 };
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
const app = createApplication(fakePool as never, secret);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function authenticate(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password }),
  });
  assert.equal(response.status, 200);
  const result = await response.json() as { access_token: string };
  return result.access_token;
}

test("protects admin inventory endpoints and rejects invalid products", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(unauthorized.status, 401);

  const token = await authenticate();
  const invalid = await fetch(`${baseUrl}/api/admin/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Invalid switch", category: "Switches", price: -1, stock: -2 }),
  });
  assert.equal(invalid.status, 400);
});

test("publishes active products and supports administrator inventory updates", async () => {
  const token = await authenticate();
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
