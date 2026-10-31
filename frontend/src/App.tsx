import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";

type View = "dashboard" | "products" | "storefront" | "settings";
type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type AppSettings = {
  apiUrl: string;
  cloudName: string;
  uploadPreset: string;
};
type AuthSession = {
  access_token: string;
  refresh_token?: string;
  user: { id: string; phone?: string; role?: string };
};
type ToastMessage = { id: number; message: string; error: boolean };
type IconName =
  | "alert" | "book" | "bolt" | "box" | "check" | "chevron" | "close"
  | "database" | "download" | "eye" | "grid" | "image" | "info" | "layers"
  | "camera" | "link" | "lock" | "logout" | "menu" | "more" | "plus" | "search"
  | "settings" | "shield" | "shop" | "spark" | "upload" | "save";

const STORAGE_KEYS = {
  catalog: "jbr-admin-products-v1",
  settings: "jbr-admin-settings-v1",
  session: "jbr-admin-session-v1",
  demoUsers: "jbr-demo-users-v1",
} as const;

const LOCAL_DEMO_MODE = import.meta.env.VITE_LOCAL_DEMO_MODE === "true";
const PUBLIC_CATALOG_WRITES = !LOCAL_DEMO_MODE && import.meta.env.VITE_PUBLIC_CATALOG_WRITES === "true";
const BUILD_SETTINGS: AppSettings = {
  apiUrl: LOCAL_DEMO_MODE ? "" : import.meta.env.VITE_PUBLIC_API_URL?.trim() ?? "",
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ?? "",
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ?? "",
};

const ICONS: Record<IconName, ReactNode> = {
  alert: <><path d="m10.3 3.9-8 13.8A2 2 0 0 0 4 20.7h16a2 2 0 0 0 1.7-3l-8-13.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  bolt: <path d="m13 2-3 9h7l-6 11 1-9H5l8-11Z" />,
  camera: <><path d="M14 5h-4l-2 3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3l-2-3Z" /><circle cx="12" cy="13" r="3" /></>,
  box: <><path d="m21 8-9 5-9-5" /><path d="M3.3 7A2 2 0 0 1 4.2 6L11 2.2a2 2 0 0 1 2 0L19.8 6a2 2 0 0 1 1.2 1.8v8.4a2 2 0 0 1-1.2 1.8L13 21.8a2 2 0 0 1-2 0l-6.8-3.8A2 2 0 0 1 3 16.2V7.8a2 2 0 0 1 .3-.8Z" /><path d="M12 13v9" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5m5 5H9" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <path d="M12 5v14m-7-7h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.7a8 8 0 0 1-1.6.9l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.6-.9l-1.8.7-1.4-2.4 1.5-1.2a7 7 0 0 1 0-1.8l-1.5-1.2 1.4-2.4 1.8.7a8 8 0 0 1 1.6-.9l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.6.9l1.8-.7 1.4 2.4-1.5 1.2a7 7 0 0 1 0 1.8Z" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  shop: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5m5-5v12" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;
}

function readSession(): AuthSession | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.session);
    return saved ? JSON.parse(saved) as AuthSession : null;
  } catch (error) {
    console.error("Could not read the saved admin session.", error);
    return null;
  }
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch (error) {
    console.error(`Could not read local data "${key}".`, error);
    return fallback;
  }
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `jbr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initialCatalog(): Product[] {
  const saved = readStorage<Product[] | null>(STORAGE_KEYS.catalog, null);
  if (saved) return saved;
  const created = new Date().toISOString();
  return [
    { id: makeId(), name: "LED Bulb, 9W Cool White", sku: "JBR-LB-009", category: "Lighting", description: "Energy-saving LED bulb with bright cool-white light for homes and workspaces.", price: 85, stock: 42, image_url: "", active: true, created_at: created, updated_at: created },
    { id: makeId(), name: "Modular Switch, 6A", sku: "JBR-SW-006", category: "Switches", description: "Durable 6 amp modular switch with a smooth, reliable operating feel.", price: 45, stock: 3, image_url: "", active: true, created_at: created, updated_at: created },
    { id: makeId(), name: "Copper Wire, 1.5 sq mm", sku: "JBR-WR-015", category: "Wires & Cables", description: "Flexible, high-conductivity copper wire for safe household electrical installations.", price: 1450, stock: 18, image_url: "", active: true, created_at: created, updated_at: created },
    { id: makeId(), name: "MCB, Double Pole 32A", sku: "JBR-MC-032", category: "Protection", description: "Double-pole miniature circuit breaker for dependable circuit protection.", price: 520, stock: 0, image_url: "", active: false, created_at: created, updated_at: created },
    { id: makeId(), name: "Ceiling Fan, 1200 mm", sku: "JBR-FN-120", category: "Fans", description: "Quiet, high-air-delivery ceiling fan with a clean modern finish.", price: 1890, stock: 6, image_url: "", active: true, created_at: created, updated_at: created },
    { id: makeId(), name: "LED Batten, 20W", sku: "JBR-LB-020", category: "Lighting", description: "Slim 20 watt LED batten for bright and even illumination.", price: 240, stock: 27, image_url: "", active: true, created_at: created, updated_at: created },
  ];
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount || 0);
}

function plural(count: number, singular: string, multiple = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : multiple}`;
}

function safeSettings(): AppSettings {
  const saved = readStorage<Partial<AppSettings> & { supabaseUrl?: string; supabaseKey?: string }>(STORAGE_KEYS.settings, {});
  const migrated: AppSettings = {
    apiUrl: LOCAL_DEMO_MODE ? "" : typeof saved.apiUrl === "string" && saved.apiUrl ? saved.apiUrl : BUILD_SETTINGS.apiUrl,
    cloudName: typeof saved.cloudName === "string" && saved.cloudName ? saved.cloudName : BUILD_SETTINGS.cloudName,
    uploadPreset: typeof saved.uploadPreset === "string" && saved.uploadPreset ? saved.uploadPreset : BUILD_SETTINGS.uploadPreset,
  };
  if (saved.supabaseKey || saved.supabaseUrl) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(migrated));
    localStorage.removeItem(STORAGE_KEYS.session);
  }
  return migrated;
}

function productFromUnknown(value: unknown): Product | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.name !== "string" || !row.name.trim() || typeof row.category !== "string" || !row.category.trim()) return null;
  const numericPrice = Number(row.price);
  const numericStock = Number(row.stock);
  if (!Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isInteger(numericStock) || numericStock < 0) return null;
  const now = new Date().toISOString();
  return {
    id: typeof row.id === "string" ? row.id : makeId(),
    name: row.name.trim().slice(0, 120),
    sku: typeof row.sku === "string" ? row.sku.trim().slice(0, 60) : "",
    category: row.category.trim().slice(0, 60),
    description: typeof row.description === "string" ? row.description.slice(0, 1000) : "",
    price: numericPrice,
    stock: numericStock,
    image_url: typeof row.image_url === "string" ? row.image_url : "",
    active: row.active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : now,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : now,
  };
}

function apiBase(settings: AppSettings): string {
  return settings.apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const details = parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message: unknown }).message)
      : parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
      : typeof parsed === "string" && parsed ? parsed : response.statusText;
    throw new Error(details || `Request failed (${response.status}).`);
  }
  return parsed as T;
}

async function renewSession(config: AppSettings, refreshToken: string): Promise<AuthSession> {
  const response = await fetch(`${apiBase(config)}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const renewed = await readResponse<AuthSession>(response);
  if (!renewed.access_token || !renewed.refresh_token || !renewed.user?.id) {
    throw new Error("The server did not return a valid renewed session.");
  }
  return renewed;
}

function ProductPhoto({ product, className = "" }: { product: Pick<Product, "name" | "image_url">; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_url]);
  return <div className={`product-thumb ${className}`}>{product.image_url && !failed ? <img src={product.image_url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icon name="image" />}</div>;
}

function App() {
  const [products, setProducts] = useState<Product[]>(initialCatalog);
  const [settings, setSettings] = useState<AppSettings>(safeSettings);
  const [view, setView] = useState<View>("dashboard");
  const [mode, setMode] = useState<"demo" | "remote">("demo");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [remoteAdmin, setRemoteAdmin] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [registrationAvailable, setRegistrationAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null | undefined>(undefined);
  const [menuProductId, setMenuProductId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(settings);
  const [loginError, setLoginError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const notify = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, error }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
  }, []);

  const remoteConfigured = Boolean(settings.apiUrl);

  const authenticatedFetch = useCallback(async (auth: AuthSession, url: string, init: RequestInit = {}) => {
    const send = (token: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    };
    let activeSession = auth;
    let response = await send(activeSession.access_token);
    if (response.status === 401 && activeSession.refresh_token) {
      try {
        activeSession = await renewSession(settings, activeSession.refresh_token);
      } catch (error) {
        localStorage.removeItem(STORAGE_KEYS.session);
        setSession(null);
        setRemoteAdmin(false);
        setLoginRequired(true);
        setLoginError(error instanceof Error ? error.message : "Your sign-in session expired. Sign in again.");
        throw error;
      }
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(activeSession));
      setSession(activeSession);
      response = await send(activeSession.access_token);
    }
    return response;
  }, [settings]);

  useEffect(() => {
    const configured = !LOCAL_DEMO_MODE && Boolean(settings.apiUrl);
    if (!configured) {
      setMode("demo");
      const localSession = readSession();
      setSession(localSession);
      setLoginRequired(!localSession?.access_token || !localSession.user?.id);
      setRegistrationAvailable(true);
      return;
    }
    setMode("remote");
    if (PUBLIC_CATALOG_WRITES) {
      setSession(null);
      setLoginRequired(false);
      void fetch(`${apiBase(settings)}/api/admin/products`)
        .then(readResponse<Product[]>)
        .then((catalog) => {
          if (!Array.isArray(catalog)) throw new Error("The server returned an invalid product catalog.");
          setProducts(catalog);
          setRemoteAdmin(true);
        })
        .catch((error: unknown) => {
          setRemoteAdmin(false);
          notify(error instanceof Error ? `Could not load the live catalog: ${error.message}` : "Could not load the live catalog.", true);
        });
      return;
    }
    const savedSession = readSession();
    if (!savedSession?.access_token || !savedSession.user?.id) {
      setLoginRequired(true);
      void fetch(`${apiBase(settings)}/api/auth/config`)
        .then(readResponse<{ email: string; registration_available: boolean }>)
        .then((config) => {
          if (typeof config.email !== "string") {
            throw new Error("The server returned an invalid sign-in configuration.");
          }
          if (config.email) setLoginEmail((current) => current || config.email);
          setRegistrationAvailable(config.registration_available === true);
        })
        .catch((error: unknown) => {
          setLoginError(error instanceof Error ? `Could not load the configured admin email: ${error.message}` : "Could not load the configured admin email.");
        });
      return;
    }
    setSession(savedSession);
    setLoginRequired(true);
    void verifyAdministrator(settings, savedSession);
  // Initial startup checks the persisted connection exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyAdministrator = useCallback(async (config: AppSettings, savedAuth: AuthSession) => {
    try {
      if (!savedAuth.refresh_token) throw new Error("This saved sign-in needs to be renewed. Please sign in again.");
      const auth = await renewSession(config, savedAuth.refresh_token);
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(auth));
      const identity = await readResponse<{ user: AuthSession["user"] }>(await fetch(`${apiBase(config)}/api/auth/me`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      }));
      if (identity.user.role !== "ADMIN") throw new Error("This account does not have JBR Electrical administrator access.");
      const catalogResponse = await fetch(`${apiBase(config)}/api/admin/products`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      });
      const catalog = await readResponse<Product[]>(catalogResponse);
      setSession(auth);
      setRemoteAdmin(true);
      setLoginRequired(false);
      setProducts(catalog);
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(auth));
    } catch (error) {
      localStorage.removeItem(STORAGE_KEYS.session);
      setSession(null);
      setRemoteAdmin(false);
      setLoginRequired(true);
      setLoginError(error instanceof Error ? error.message : "Could not verify the administrator account.");
    }
  }, []);

  const categoryNames = useMemo(() => [...new Set(products.map((product) => product.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [product.name, product.sku, product.category, product.description].some((field) => field.toLocaleLowerCase().includes(query));
    return matchesSearch
      && (!categoryFilter || product.category === categoryFilter)
      && (!statusFilter || (statusFilter === "active" ? product.active : !product.active));
  }), [products, search, categoryFilter, statusFilter]);
  const publishedProducts = useMemo(() => products.filter((product) => product.active), [products]);
  const lowStockProducts = useMemo(() => products.filter((product) => product.stock <= 5).sort((a, b) => a.stock - b.stock), [products]);

  useEffect(() => {
    document.title = `JBR Electrical — ${view === "dashboard" ? "Overview" : view === "storefront" ? "Storefront" : view === "settings" ? "Settings" : "Products"}`;
  }, [view]);

  useEffect(() => {
    if (!modalProduct && !loginRequired) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalProduct(undefined);
        setMenuProductId(null);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalProduct, loginRequired]);

  const saveDemoProducts = useCallback((next: Product[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(next));
      setProducts(next);
    } catch (error) {
      console.error("Could not save the demo catalog in this browser.", error);
      throw new Error("Could not save the catalog in this browser. The image may be too large; connect Cloudinary or choose a smaller image.");
    }
  }, []);

  const persistProduct = useCallback(async (product: Product): Promise<void> => {
    if (mode === "demo") {
      const exists = products.some((item) => item.id === product.id);
      const next = exists ? products.map((item) => item.id === product.id ? product : item) : [product, ...products];
      saveDemoProducts(next);
      return;
    }
    if (!remoteAdmin) throw new Error("The live catalog is not connected. Wait for it to load before editing products.");
    if (PUBLIC_CATALOG_WRITES) {
      const exists = products.some((item) => item.id === product.id);
      const payload = {
        name: product.name,
        sku: product.sku,
        category: product.category,
        description: product.description,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url,
        active: product.active,
      };
      const url = `${apiBase(settings)}/api/admin/products${exists ? `/${encodeURIComponent(product.id)}` : ""}`;
      const response = await fetch(url, {
        method: exists ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await readResponse<Product>(response);
      if (!saved?.id) throw new Error("The server did not return the saved product.");
      setProducts((current) => {
        const alreadyExists = current.some((item) => item.id === saved.id);
        return alreadyExists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
      });
      return;
    }
    if (!session) throw new Error("Sign in with an approved store administrator account to edit products.");
    const { id } = product;
    const payload = {
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
      active: product.active,
    };
    const isExisting = products.some((item) => item.id === product.id);
    const response = await authenticatedFetch(session, `${apiBase(settings)}/api/admin/products${isExisting ? `/${encodeURIComponent(id)}` : ""}`, {
      method: isExisting ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const saved = await readResponse<Product>(response);
    if (!saved?.id) throw new Error("The server did not return the saved product.");
    setProducts((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
    });
  }, [mode, products, saveDemoProducts, session, remoteAdmin, settings, authenticatedFetch]);

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}" from the catalog? This cannot be undone.`)) return;
    try {
      if (mode === "demo") {
        saveDemoProducts(products.filter((item) => item.id !== product.id));
      } else if (PUBLIC_CATALOG_WRITES) {
        if (!remoteAdmin) throw new Error("The live catalog is not connected. Wait for it to load before editing products.");
        const response = await fetch(`${apiBase(settings)}/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
        await readResponse<unknown>(response);
        setProducts((current) => current.filter((item) => item.id !== product.id));
      } else {
        if (!remoteAdmin || !session) throw new Error("Sign in with an approved store administrator account to edit products.");
        const response = await authenticatedFetch(session, `${apiBase(settings)}/api/admin/products/${encodeURIComponent(product.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        await readResponse<unknown>(response);
        setProducts((current) => current.filter((item) => item.id !== product.id));
      }
      setMenuProductId(null);
      notify("Product deleted from your catalog.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete this product.", true);
    }
  };

  const changeView = (next: View) => {
    setView(next);
    setMobileNavOpen(false);
    setMenuProductId(null);
  };

  const openProduct = (product?: Product) => {
    setModalProduct(product ?? null);
    setMenuProductId(null);
  };

  const saveDatabaseSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (LOCAL_DEMO_MODE) {
      notify("This build is in local demo mode. Rebuild without VITE_LOCAL_DEMO_MODE to connect the live store.", true);
      return;
    }
    const url = settingsDraft.apiUrl.trim().replace(/\/+$/, "").replace(/\/api$/, "");
    if (url && !/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(url) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(url)) {
      notify("Enter a valid HTTPS API server URL. HTTP is allowed only for localhost.", true);
      return;
    }
    const next = { ...settingsDraft, apiUrl: url };
    try {
      let publicCatalog: Product[] | undefined;
      if (url) {
        const response = await fetch(`${url}/api/health`);
        await readResponse<{ status: string }>(response);
        if (PUBLIC_CATALOG_WRITES) {
          publicCatalog = await readResponse<Product[]>(await fetch(`${apiBase(next)}/api/admin/products`));
          if (!Array.isArray(publicCatalog)) throw new Error("The server returned an invalid product catalog.");
        }
      }
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      localStorage.removeItem(STORAGE_KEYS.session);
      setSettings(next);
      setSettingsDraft(next);
      setSession(null);
      setRemoteAdmin(false);
      if (url) {
        setMode("remote");
        if (PUBLIC_CATALOG_WRITES) {
          setProducts(publicCatalog ?? []);
          setRemoteAdmin(true);
          setLoginRequired(false);
          setLoginError("");
          notify("Live catalog connected. Anyone with access to this API can edit or delete products.");
        } else {
          setLoginRequired(true);
          setLoginError("");
          notify("JBR store API connected. Sign in with your administrator username and password.");
        }
      } else {
        setMode("demo");
        setLoginRequired(false);
        setRemoteAdmin(false);
        notify("Database disconnected. Your demo catalog is ready.");
      }
    } catch (error) {
      notify(`Could not save connection settings: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    }
  };

  const saveCloudSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = { ...settingsDraft, cloudName: settingsDraft.cloudName.trim(), uploadPreset: settingsDraft.uploadPreset.trim() };
    if (Boolean(next.cloudName) !== Boolean(next.uploadPreset)) {
      notify("Enter both a Cloudinary cloud name and unsigned upload preset.", true);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      setSettings(next);
      setSettingsDraft(next);
      notify(next.cloudName ? "Cloudinary image storage is ready." : "Cloudinary settings cleared.");
    } catch (error) {
      notify(`Could not save image settings: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    }
  };

  const changeAdminPassword = async (currentPassword: string, newPassword: string) => {
    if (!session) throw new Error("Sign in to change the administrator password.");
    const response = await authenticatedFetch(session, `${apiBase(settings)}/api/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!response.ok) await readResponse<unknown>(response);
    localStorage.removeItem(STORAGE_KEYS.session);
    setSession(null);
    setRemoteAdmin(false);
    setLoginRequired(true);
    setLoginError("Password changed. Sign in again with your new password.");
  };

  const disconnectDatabase = () => {
    const next = { ...settings, apiUrl: "" };
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      localStorage.removeItem(STORAGE_KEYS.session);
      setSettings(next);
      setSettingsDraft(next);
      setSession(null);
      setRemoteAdmin(false);
      setMode("demo");
      setLoginRequired(false);
      notify("Database disconnected. Your demo catalog is ready.");
    } catch (error) {
      notify(`Could not disconnect the database: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    }
  };

  const completeSignIn = async (loginResult: AuthSession) => {
    if (!loginResult.access_token || !loginResult.refresh_token || !loginResult.user?.id) throw new Error("The server did not return a valid sign-in session.");
    if (loginResult.user.role !== "ADMIN") throw new Error("This account does not have JBR Electrical administrator access.");
    const catalogResponse = await fetch(`${apiBase(settings)}/api/admin/products`, {
      headers: { Authorization: `Bearer ${loginResult.access_token}` },
    });
    const remoteProducts = await readResponse<Product[]>(catalogResponse);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(loginResult));
    setProducts(remoteProducts);
    setSession(loginResult);
    setRemoteAdmin(true);
    setMode("remote");
    setLoginRequired(false);
    setRegistrationAvailable(false);
    setLoginPassword("");
    notify("Welcome to your JBR Electrical admin workspace.");
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      if (!remoteConfigured) {
        const users = readStorage<Array<{ email: string; passwordHash: string; name: string }>>(STORAGE_KEYS.demoUsers, []);
        const normalizedEmail = loginEmail.trim().toLowerCase();
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(loginPassword));
        const passwordHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        const user = users.find((item) => item.email === normalizedEmail && item.passwordHash === passwordHash);
        if (!user) throw new Error("Email or password is incorrect. Create an account first.");
        const localSession: AuthSession = { access_token: `local-${crypto.randomUUID()}`, refresh_token: `local-${crypto.randomUUID()}`, user: { id: normalizedEmail, role: "ADMIN" } };
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(localSession));
        setSession(localSession); setRemoteAdmin(false); setMode("demo"); setLoginRequired(false); setLoginPassword("");
        notify(`Welcome back, ${user.name || user.email}! Demo workspace opened.`);
        return;
      }
      const response = await fetch(`${apiBase(settings)}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      await completeSignIn(await readResponse<AuthSession>(response));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const registerAdmin = async (event: FormEvent<HTMLFormElement>, registrationCode: string) => {
    event.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      if (!remoteConfigured) {
        const users = readStorage<Array<{ email: string; passwordHash: string; name: string }>>(STORAGE_KEYS.demoUsers, []);
        const normalizedEmail = loginEmail.trim().toLowerCase();
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
        if (loginPassword.length < 8) throw new Error("Use a password with at least 8 characters.");
        if (users.some((item) => item.email === normalizedEmail)) throw new Error("An account with this email already exists. Please sign in.");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(loginPassword));
        const passwordHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        const name = normalizedEmail.split("@")[0];
        localStorage.setItem(STORAGE_KEYS.demoUsers, JSON.stringify([...users, { email: normalizedEmail, passwordHash, name }]));
        const localSession: AuthSession = { access_token: `local-${crypto.randomUUID()}`, refresh_token: `local-${crypto.randomUUID()}`, user: { id: normalizedEmail, role: "ADMIN" } };
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(localSession));
        setSession(localSession); setRemoteAdmin(false); setMode("demo"); setLoginRequired(false); setLoginPassword("");
        notify("Account created! You’re now inside the JBR demo workspace.");
        return;
      }
      const response = await fetch(`${apiBase(settings)}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          registration_code: registrationCode,
        }),
      });
      await completeSignIn(await readResponse<AuthSession>(response));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not create the administrator account. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const auth = session;
    localStorage.removeItem(STORAGE_KEYS.session);
    setSession(null);
    setRemoteAdmin(false);
    setLoginRequired(true);
    setLoginError("");
    if (auth?.refresh_token) {
      try {
        const response = await fetch(`${apiBase(settings)}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: auth.refresh_token }),
        });
        if (!response.ok) await readResponse<unknown>(response);
      } catch (error) {
        notify(`Signed out on this device, but server session revocation failed: ${error instanceof Error ? error.message : "network error."}`, true);
      }
    }
  };

  const uploadProductImage = async (file: File, imageSetter: (url: string) => void) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      notify("Choose a JPEG, PNG, WebP, or AVIF image.", true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("Images must be 8 MB or smaller.", true);
      return;
    }
    setLoading(true);
    try {
      if (settings.cloudName && settings.uploadPreset) {
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", settings.uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName)}/image/upload`, { method: "POST", body: form });
        const uploaded = await readResponse<{ secure_url?: string; error?: { message?: string } }>(response);
        if (!uploaded.secure_url) throw new Error(uploaded.error?.message ?? "Cloudinary did not return a secure image URL.");
        imageSetter(uploaded.secure_url);
        notify("Product image uploaded to Cloudinary.");
      } else {
        if (mode === "remote") throw new Error("Connect Cloudinary in Settings before uploading product photos in live database mode.");
        const imageData = await compressImage(file);
        imageSetter(imageData);
        notify("Image added to your local demo product.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not upload this image.", true);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, imageSetter: (url: string) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadProductImage(file, imageSetter);
  };

  const takeProductPhoto = async (imageSetter: (url: string) => void) => {
    if (!(settings.cloudName && settings.uploadPreset) && mode === "remote") {
      notify("Connect Cloudinary in Settings before adding product photos to your live catalog.", true);
      return;
    }
    setLoading(true);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        width: 1600,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true,
      });
      if (!photo.webPath) throw new Error("The camera did not return a photo. Please try again.");
      const response = await fetch(photo.webPath);
      if (!response.ok) throw new Error("Could not read the camera photo. Please take the photo again.");
      const imageBlob = await response.blob();
      const imageFile = new File([imageBlob], `jbr-product-${Date.now()}.jpg`, { type: imageBlob.type || "image/jpeg" });
      await uploadProductImage(imageFile, imageSetter);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel|user denied|permission denied/i.test(message)) {
        notify(`Could not take a product photo: ${message}`, true);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportCatalog = (format: "csv" | "json") => {
    if (format === "csv") {
      const columns: Array<keyof Product> = ["name", "sku", "category", "description", "price", "stock", "image_url", "active", "created_at", "updated_at"];
      const quote = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
      const rows = [columns.join(","), ...products.map((product) => columns.map((column) => quote(product[column])).join(","))];
      downloadFile("jbr-electrical-products.csv", rows.join("\r\n"), "text/csv;charset=utf-8");
      notify("Product catalog exported as CSV.");
      return;
    }
    downloadFile("jbr-electrical-backup.json", JSON.stringify({ exported_at: new Date().toISOString(), shop: "JBR Electrical", products }, null, 2), "application/json");
    notify("Catalog backup exported as JSON.");
  };

  const importCatalog = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (mode !== "demo") {
      notify("JSON restore is available in demo mode only. Use your database provider's backup tools to restore the live catalog.", true);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { products?: unknown }).products)
          ? (parsed as { products: unknown[] }).products
          : null;
      if (!list) throw new Error("This file does not contain a product array.");
      const restored = list.map(productFromUnknown);
      if (restored.some((product) => product === null)) throw new Error("One or more products have missing names/categories or invalid price/stock values.");
      saveDemoProducts(restored as Product[]);
      notify(`${plural(restored.length, "product")} restored from backup.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not restore this backup.", true);
    }
  };

  const pageLabels: Record<View, string> = { dashboard: "Overview", products: "Products", storefront: "Storefront", settings: "Settings" };
  const currentDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  const visibleAdmin = !loginRequired;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); changeView("dashboard"); }} aria-label="JBR Electrical dashboard">
          <BrandMark /><span className="brand-copy"><strong>JBR <span>Electrical</span></strong><small>STORE MANAGEMENT</small></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <NavButton name="dashboard" current={view} icon="grid" label="Overview" onSelect={changeView} />
          <NavButton name="products" current={view} icon="box" label="Products" onSelect={changeView} count={products.length} />
          <NavButton name="storefront" current={view} icon="shop" label="Storefront" onSelect={changeView} />
        </nav>
        <div className="nav-caption nav-caption-lower">PREFERENCES</div>
        <nav className="main-nav"><NavButton name="settings" current={view} icon="settings" label="Settings & setup" onSelect={changeView} /></nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Icon name="shop" /></div><strong>Customer storefront</strong><p>View the live shopping page that customers see.</p><a className="text-button" href="/" target="_blank" rel="noreferrer">View storefront <span aria-hidden="true">↗</span></a></div>
          <div className="user-row"><span className="user-avatar">J</span><span className="user-copy"><strong>JBR Electrical</strong><small>{session?.user.id ?? "Admin"}</small></span>{session && <button className="icon-button sign-out-button" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>JBR Electrical</span><span className="crumb-separator">/</span><strong>{pageLabels[view]}</strong></div>
          <div className="topbar-actions"><span className={`connection-pill ${mode === "remote" && remoteAdmin ? "is-connected" : ""}`}><span className="connection-dot" /><span>{mode === "remote" && remoteAdmin ? "Database connected" : "Demo mode"}</span></span><span className="topbar-date">{currentDate}</span><span className="top-avatar">J</span></div>
        </header>

        {visibleAdmin && <div className="page-wrap">
          {view === "dashboard" && <DashboardView products={products} lowStock={lowStockProducts} openProduct={openProduct} changeView={changeView} />}
          {view === "products" && <ProductsView
            products={filteredProducts} allCount={products.length} categories={categoryNames} search={search} setSearch={setSearch}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            openProduct={openProduct} deleteProduct={(product) => void deleteProduct(product)} menuProductId={menuProductId}
            setMenuProductId={setMenuProductId}
            updateStock={(product, stock) => persistProduct({ ...product, stock, updated_at: new Date().toISOString() })}
            exportCsv={() => exportCatalog("csv")}
          />}
          {view === "storefront" && <StorefrontView products={publishedProducts} count={publishedProducts.length} search={storeSearch} setSearch={setStoreSearch} changeView={changeView} />}
          {LOCAL_DEMO_MODE && <div className="site-integration-warning" role="note"><Icon name="info" /><div><strong>Local demo mode — no sign-in required.</strong><p>Catalog changes are saved only on this device. They do not update the live JBR website or database.</p></div></div>}
          {PUBLIC_CATALOG_WRITES && <div className="site-integration-warning" role="alert"><Icon name="alert" /><div><strong>Public live editing is enabled.</strong><p>Anyone who can reach this API may view the full catalog and add, change, or delete products in the live database. Rate limiting is only a basic throttle, not access control.</p></div></div>}
          {view === "settings" && <SettingsView settings={settingsDraft} setSettings={setSettingsDraft} databaseConnected={mode === "remote" && remoteAdmin} localDemoOnly={LOCAL_DEMO_MODE} publicCatalogWrites={PUBLIC_CATALOG_WRITES} canChangePassword={mode === "remote" && remoteAdmin && Boolean(session)} changePassword={changeAdminPassword} saveDatabase={saveDatabaseSettings} disconnectDatabase={disconnectDatabase} saveCloud={saveCloudSettings} exportJson={() => exportCatalog("json")} importCatalog={importCatalog} notify={notify} />}
        </div>}
      </main>

      {visibleAdmin && <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton name="dashboard" current={view} icon="grid" label="Home" onSelect={changeView} />
        <NavButton name="products" current={view} icon="box" label="Products" onSelect={changeView} count={products.length} />
        <NavButton name="storefront" current={view} icon="shop" label="Store" onSelect={changeView} />
        <NavButton name="settings" current={view} icon="settings" label="Settings" onSelect={changeView} />
      </nav>}

      {visibleAdmin && modalProduct !== undefined && <ProductDialog
        product={modalProduct} categories={categoryNames} mode={mode} settings={settings}
        onClose={() => setModalProduct(undefined)} onSave={persistProduct} onUploadImage={uploadImage}
        onTakePhoto={takeProductPhoto} notify={notify}
      />}
      {loginRequired && <LoginDialog
        onSignIn={signIn} onRegister={registerAdmin} loading={loading} error={loginError}
        email={loginEmail} setEmail={setLoginEmail} password={loginPassword} setPassword={setLoginPassword}
        registrationAvailable={registrationAvailable}
      />}
      {loading && <div className="busy-indicator" role="status" aria-live="polite"><span className="spinner" /> Working…</div>}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => <div className={`toast ${toast.error ? "error" : ""}`} key={toast.id}><span className="toast-icon"><Icon name={toast.error ? "alert" : "check"} /></span><span className="toast-message">{toast.message}</span></div>)}
      </div>
    </div>
  );
}

function BrandMark() {
  return <span className="brand-mark"><Icon name="bolt" /></span>;
}

function NavButton({ name, current, icon, label, onSelect, count }: { name: View; current: View; icon: IconName; label: string; onSelect: (view: View) => void; count?: number }) {
  return <button className={`nav-link ${current === name ? "is-active" : ""}`} onClick={() => onSelect(name)}><span className="nav-icon"><Icon name={icon} /></span><span>{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}</button>;
}

function DashboardView({ products, lowStock, openProduct, changeView }: { products: Product[]; lowStock: Product[]; openProduct: (product?: Product) => void; changeView: (view: View) => void }) {
  const activeCount = products.filter((product) => product.active).length;
  const categories = new Set(products.map((product) => product.category)).size;
  const recentProducts = [...products].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  return <section className="view-panel is-visible">
    <div className="page-heading dashboard-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR BUSINESS AT A GLANCE</div><h1>Good to see you<span className="heading-period">.</span></h1><p>Here’s what’s happening with your store today.</p></div><button className="button button-primary" onClick={() => openProduct()}><Icon name="plus" /> Add product</button></div>
    <div className="stats-grid">
      <StatCard label="Total products" value={products.length} note="In your product catalog" icon="box" color="blue" />
      <StatCard label="Published online" value={activeCount} note="Visible on your storefront" icon="eye" color="green" />
      <StatCard label="Low stock" value={lowStock.length} note="Products with 5 or fewer units" icon="alert" color="amber" />
      <StatCard label="Categories" value={categories} note="Across your catalog" icon="layers" color="purple" />
    </div>
    <div className="dashboard-grid">
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recently updated</h2><p>Your latest catalog changes</p></div><button className="button button-quiet button-small" onClick={() => changeView("products")}>View all <span aria-hidden="true">→</span></button></div>
        {recentProducts.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>STATUS</th></tr></thead><tbody>{recentProducts.map((product) => <tr key={product.id}><td><ProductIdentity product={product} /></td><td>{product.category}</td><td>{formatPrice(product.price)}</td><td><StatusBadge active={product.active} /></td></tr>)}</tbody></table></div> : <EmptyState title="Your catalog starts here" description="Add your first product to see it here." action="Add a product" onAction={() => openProduct()} compact />}
      </section>
      <section className="panel stock-panel"><div className="panel-heading"><div><h2>Stock watch</h2><p>Items that may need a restock</p></div><span className="panel-heading-icon"><Icon name="alert" /></span></div>
        {lowStock.length > 0 ? <div className="stock-list">{lowStock.slice(0, 5).map((product) => <div className="stock-item" key={product.id}><ProductPhoto product={product} /><div className="stock-info"><strong title={product.name}>{product.name}</strong><small>{product.category}</small></div><span className="stock-quantity">{product.stock === 0 ? "Out of stock" : `${product.stock} left`}</span></div>)}</div> : <EmptyStock />}
      </section>
    </div>
    <section className="tip-banner"><span className="tip-bolt"><Icon name="bolt" /></span><div><strong>A brighter storefront starts with a great catalog.</strong><p>Keep product details and stock up to date so customers always see the right information.</p></div><button className="button button-quiet button-small" onClick={() => changeView("storefront")}>Preview storefront <span aria-hidden="true">→</span></button></section>
  </section>;
}

function StatCard({ label, value, note, icon, color }: { label: string; value: number; note: string; icon: IconName; color: string }) {
  return <article className="stat-card"><div className="stat-top"><span className="stat-label">{label}</span><span className={`stat-icon stat-icon-${color}`}><Icon name={icon} /></span></div><div className="stat-value">{value}</div><div className="stat-foot"><span className={`stat-foot-dot ${color}-dot`} /><span>{note}</span></div></article>;
}

function ProductIdentity({ product }: { product: Product }) {
  return <div className="product-cell"><ProductPhoto product={product} /><div><div className="product-name" title={product.name}>{product.name}</div>{product.sku && <div className="product-sku">{product.sku}</div>}</div></div>;
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`status-badge ${active ? "status-active" : "status-draft"}`}>{active ? "Published" : "Draft"}</span>;
}

function StockControls({ product, onSave }: { product: Product; onSave: (product: Product, stock: number) => Promise<void> }) {
  const [quantity, setQuantity] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setQuantity(String(product.stock)), [product.stock]);

  const save = async (stock: number) => {
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000_000) {
      setError("Enter a whole stock quantity from 0 to 1,000,000,000.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(product, stock);
      setQuantity(String(stock));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update this stock count.");
    } finally {
      setSaving(false);
    }
  };

  const pendingQuantity = Number(quantity);
  const dirty = quantity.trim() !== String(product.stock) && Number.isInteger(pendingQuantity) && pendingQuantity >= 0;

  return <div className="stock-controls">
    <button className="stock-stepper-button" type="button" aria-label={`Decrease ${product.name} stock`} disabled={saving || product.stock === 0} onClick={() => void save(product.stock - 1)}>−</button>
    <input className="stock-quantity-input" type="number" inputMode="numeric" min="0" max="1000000000" step="1" value={quantity} disabled={saving} aria-label={`Stock quantity for ${product.name}`} onChange={(event) => { setError(""); setQuantity(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(pendingQuantity); } }} />
    <button className="stock-stepper-button" type="button" aria-label={`Increase ${product.name} stock`} disabled={saving || product.stock >= 1_000_000_000} onClick={() => void save(product.stock + 1)}>+</button>
    {dirty && <button className="stock-save-button" type="button" disabled={saving} onClick={() => void save(pendingQuantity)}>{saving ? "…" : "Save"}</button>}
    {error && <span className="stock-control-error" role="alert">{error}</span>}
  </div>;
}

function EmptyState({ title, description, action, onAction, compact = false }: { title: string; description: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact-empty" : ""}`}><span className="empty-illustration"><Icon name="box" /></span><strong>{title}</strong><p>{description}</p>{action && onAction && <button className="button button-primary button-small" onClick={onAction}>{action}</button>}</div>;
}

function EmptyStock() {
  return <div className="empty-state stock-empty"><span className="stock-check"><Icon name="check" /></span><strong>All stocked up</strong><p>No products are running low.</p></div>;
}

function ProductsView({ products, allCount, categories, search, setSearch, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, openProduct, deleteProduct, menuProductId, setMenuProductId, updateStock, exportCsv }: {
  products: Product[];
  allCount: number;
  categories: string[];
  search: string;
  setSearch: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  openProduct: (product?: Product) => void;
  deleteProduct: (product: Product) => void;
  menuProductId: string | null;
  setMenuProductId: (id: string | null) => void;
  updateStock: (product: Product, stock: number) => Promise<void>;
  exportCsv: () => void;
}) {
  const isFiltered = Boolean(search || categoryFilter || statusFilter);
  const saveStock = async (product: Product, stock: number) => {
    await updateStock(product, stock);
  };
  return <section className="view-panel is-visible">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CATALOG</div><h1>Products<span className="heading-period">.</span></h1><p>Manage your products, pricing, and availability.</p></div><button className="button button-primary" onClick={() => openProduct()}><Icon name="plus" /> Add product</button></div>
    <section className="panel catalog-panel">
      <div className="catalog-toolbar"><div className="catalog-title"><strong>All products</strong><span>{plural(allCount, "product")}</span></div><div className="catalog-filters">
        <label className="search-field"><Icon name="search" /><input type="search" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products" /></label>
        <label className="select-wrap"><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select><span><Icon name="chevron" /></span></label>
        <label className="select-wrap"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Published</option><option value="draft">Draft</option></select><span><Icon name="chevron" /></span></label>
      </div></div>
      {products.length > 0 ? <>
        <div className="table-wrap catalog-table-wrap"><table className="data-table catalog-table"><thead><tr><th className="product-col">PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {products.map((product) => <tr key={product.id}><td><ProductIdentity product={product} /></td><td>{product.sku || "—"}</td><td>{product.category}</td><td>{formatPrice(product.price)}</td><td><StockControls product={product} onSave={saveStock} /></td><td><StatusBadge active={product.active} /></td><td><div className="action-menu-wrap"><button className="row-action" onClick={() => setMenuProductId(menuProductId === product.id ? null : product.id)} aria-label={`Actions for ${product.name}`} aria-expanded={menuProductId === product.id}><Icon name="more" /></button>{menuProductId === product.id && <div className="action-popover"><button onClick={() => openProduct(product)}>Edit product</button><button className="delete-action" onClick={() => deleteProduct(product)}>Delete product</button></div>}</div></td></tr>)}
        </tbody></table></div>
        <div className="mobile-product-list">{products.map((product) => <article className="mobile-product-card" key={product.id}>
          <div className="mobile-product-header"><ProductPhoto product={product} className="mobile-product-photo" /><div className="mobile-product-identity"><strong>{product.name}</strong><small>{product.sku || product.category}</small></div><button className="row-action mobile-product-action" onClick={() => setMenuProductId(menuProductId === product.id ? null : product.id)} aria-label={`Actions for ${product.name}`} aria-expanded={menuProductId === product.id}><Icon name="more" /></button>{menuProductId === product.id && <div className="action-popover mobile-product-menu"><button onClick={() => openProduct(product)}>Edit product</button><button className="delete-action" onClick={() => deleteProduct(product)}>Delete product</button></div>}</div>
          <div className="mobile-product-details"><span>{product.category}</span><strong>{formatPrice(product.price)}</strong><StatusBadge active={product.active} /></div>
          <div className="mobile-stock-row"><span>Stock</span><StockControls product={product} onSave={saveStock} /></div>
        </article>)}</div>
      </> : <div className="empty-state catalog-empty"><span className="empty-illustration"><Icon name={isFiltered ? "search" : "box"} /></span><strong>{isFiltered ? "No products match your filters" : "No products yet"}</strong><p>{isFiltered ? "Try a different search or clear a filter." : "Add products to start building your catalog."}</p>{isFiltered ? <button className="button button-secondary button-small" onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); }}>Clear filters</button> : <button className="button button-primary button-small" onClick={() => openProduct()}>Add your first product</button>}</div>}
    </section>
    <div className="catalog-footer"><span>Showing {products.length} of {allCount} products</span><button className="button button-quiet button-small" onClick={exportCsv}><Icon name="download" /> Export CSV</button></div>
  </section>;
}

function StorefrontView({ products, count, search, setSearch, changeView }: { products: Product[]; count: number; search: string; setSearch: (value: string) => void; changeView: (view: View) => void }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const categories = [...new Set(products.map((product) => product.category))].sort();
  const query = search.trim().toLocaleLowerCase();
  const visibleProducts = products.filter((product) =>
    (!categoryFilter || product.category === categoryFilter)
    && (!query || [product.name, product.sku, product.category, product.description].some((field) => field.toLocaleLowerCase().includes(query))),
  );
  const categoryHighlights = categories.slice(0, 4).map((category) => ({
    category,
    product: products.find((product) => product.category === category),
  }));

  return <section className="view-panel is-visible">
    <div className="page-heading live-preview-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> CUSTOMER VIEW</div><h1>Storefront<span className="heading-period">.</span></h1><p>Preview the published catalog in the style of your live website.</p></div>
      <a className="button button-secondary" href="https://jbr-electrical.vercel.app" target="_blank" rel="noreferrer">Open live website <span aria-hidden="true">↗</span></a>
    </div>
    <div className="live-storefront">
      <div className="live-announcement"><span>Full version launching 1st November 2026</span><span>For enquiries, call <a href="tel:6377374179">6377374179</a> or <a href="https://wa.me/916377374179" target="_blank" rel="noreferrer">WhatsApp JBR</a>.</span></div>
      <div className="live-utility"><div><span>Quality electrical products</span><span>Reliable service</span><span>Easy enquiry</span></div><span>JBR Electrical · Troop Bazaar, Koti, Hyderabad</span></div>
      <header className="live-site-header">
        <a className="live-site-logo" href="https://jbr-electrical.vercel.app" target="_blank" rel="noreferrer">JBR <span>ELECTRICAL</span></a>
        <nav aria-label="Storefront preview navigation">{["Products", "Blog", "About", "Brands", "Services", "Contact"].map((label) => <a key={label} href={`https://jbr-electrical.vercel.app/${label === "Products" ? "" : label.toLowerCase()}`} target="_blank" rel="noreferrer">{label}</a>)}</nav>
        <a className="live-quote-button" href="https://jbr-electrical.vercel.app/quote" target="_blank" rel="noreferrer">Get a quote <span aria-hidden="true">↗</span></a>
      </header>
      <div className="live-hero">
        <div className="live-hero-copy">
          <span className="live-kicker">Electrical essentials</span>
          <h2>Wires, switches, bulbs, sockets and more for every electrical need.</h2>
          <p>Trusted electrical shop for wiring accessories, modular products, lighting solutions, protection devices, and everyday hardware for homes and projects.</p>
          <div className="live-hero-actions"><a href="#preview-products">Shop electrical items <span aria-hidden="true">→</span></a><a href="https://jbr-electrical.vercel.app/quote" target="_blank" rel="noreferrer">Get a quote</a></div>
          <p className="live-price-note">Product availability and pricing may vary. <strong>Ask JBR for current details.</strong></p>
        </div>
        <div className="live-hero-art">
          <div className="live-category-grid">{categoryHighlights.map(({ category, product }) => <div className="live-category-tile" key={category}>
            <div className="live-category-image">{product?.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <Icon name="bolt" />}</div><span>{category}</span>
          </div>)}</div>
          <div className="live-hero-stamp"><span>JBR</span><strong>Electrical<br />partner</strong></div>
        </div>
      </div>
      <section id="preview-products" className="live-catalog">
        <div className="live-catalog-heading"><div><span>ALL PRODUCTS</span><h2>Complete product list</h2><p>All items across every category. Add an item to your enquiry and ask JBR for current availability.</p></div><span className="live-count">{plural(count, "product")}</span></div>
        <label className="live-catalog-search"><Icon name="search" /><input type="search" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search storefront products" /></label>
        {categories.length > 0 && <div className="live-category-filters" aria-label="Filter products by category">
          <button className={!categoryFilter ? "is-active" : ""} onClick={() => setCategoryFilter("")}>All products</button>
          {categories.map((category) => <button className={categoryFilter === category ? "is-active" : ""} key={category} onClick={() => setCategoryFilter(category)}>{category}</button>)}
        </div>}
        {visibleProducts.length > 0 ? <div className="live-product-grid">{visibleProducts.map((product) => <article className="live-product-card" key={product.id}>
          <div className="live-product-image">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <Icon name="image" />}<span>{product.category}</span></div>
          <div className="live-product-copy"><h3>{product.name}</h3>{product.sku && <small>{product.sku}</small>}<p>{product.description || "Quality electrical supplies for your home, business, or project."}</p>
            <div className="live-product-actions"><strong>{formatPrice(product.price)}</strong><a href={`https://wa.me/916377374179?text=${encodeURIComponent(`Hello JBR Electrical, I would like to enquire about ${product.name}${product.sku ? ` (${product.sku})` : ""}.`)}`} target="_blank" rel="noreferrer">Enquire <span aria-hidden="true">↗</span></a></div>
          </div>
        </article>)}</div> : <div className="live-catalog-empty"><Icon name={count ? "search" : "shop"} /><strong>{count ? "No products match your search" : "No products published yet"}</strong><p>{count ? "Try another search or category." : "Publish products in the catalog and they will appear on the storefront."}</p>{!count && <button className="button button-primary button-small" onClick={() => changeView("products")}>Manage products</button>}</div>}
        <p className="live-preview-footnote">Preview only · Product updates reach the live website when the APK and storefront use the same connected database/API.</p>
      </section>
    </div>
  </section>;
}

function SettingsView({ settings, setSettings, databaseConnected, localDemoOnly, publicCatalogWrites, canChangePassword, changePassword, saveDatabase, disconnectDatabase, saveCloud, exportJson, importCatalog, notify }: {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  databaseConnected: boolean;
  localDemoOnly: boolean;
  publicCatalogWrites: boolean;
  canChangePassword: boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  saveDatabase: (event: FormEvent<HTMLFormElement>) => void;
  disconnectDatabase: () => void;
  saveCloud: (event: FormEvent<HTMLFormElement>) => void;
  exportJson: () => void;
  importCatalog: (event: ChangeEvent<HTMLInputElement>) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const update = (key: keyof AppSettings, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    if (newPassword.length < 12) {
      setPasswordError("Use at least 12 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify("Password changed. Sign in again with your new password.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change the password.");
    } finally {
      setChangingPassword(false);
    }
  };
  return <section className="view-panel is-visible">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {localDemoOnly ? "LOCAL CATALOG" : "CONNECT YOUR STORE"}</div><h1>Settings<span className="heading-period">.</span></h1><p>{localDemoOnly ? "Manage local demo storage and image settings." : "Connect the existing JBR store API and Cloudinary image storage."}</p></div><span className="settings-lock"><Icon name="shield" /> Store database credentials stay server-side</span></div>
    {localDemoOnly
      ? <div className="site-integration-warning" role="note"><Icon name="info" /><div><strong>This build is using a local demo catalog.</strong><p>Changes stay on this device and are not sent to the live website. Rebuild without VITE_LOCAL_DEMO_MODE to enable the protected live API.</p></div></div>
      : publicCatalogWrites
        ? <div className="site-integration-warning" role="alert"><Icon name="alert" /><div><strong>Public live catalog access is enabled without authentication.</strong><p>Anyone who can reach this API can view the full catalog and add, edit, or delete products. Rate limiting is only a basic throttle, not access control.</p></div></div>
        : <div className="site-integration-warning" role="note"><Icon name="info" /><div><strong>The APK is preconfigured to use the live JBR store API.</strong><p>Deploy the backend changes from the JBR website source before using the APK. They enable the Vercel and Android origins and add the admin catalog endpoints the APK needs. The database connection stays on the backend.</p></div></div>}
    <div className="settings-layout">
      <section className="panel settings-card">
        <div className="settings-card-heading"><span className="settings-large-icon database-icon"><Icon name="database" /></span><div><h2>{localDemoOnly ? "Local demo catalog" : "Live shop database"}</h2><p>{localDemoOnly ? "Catalog changes are saved on this device only." : "Manage the same PostgreSQL catalog the JBR website uses."}</p></div><span className={`integration-state ${databaseConnected ? "is-connected" : ""}`}>{localDemoOnly ? "Local only" : databaseConnected ? "Connected" : settings.apiUrl ? publicCatalogWrites ? "Needs API opt-in" : "Needs sign-in" : "Not connected"}</span></div>
        {!localDemoOnly && <form className="settings-form" onSubmit={saveDatabase}>
          <label className="field-label" htmlFor="api-url">JBR store API URL</label><input className="text-input" id="api-url" type="url" placeholder="https://your-api.example" autoComplete="url" value={settings.apiUrl} onChange={(event) => update("apiUrl", event.target.value)} />
          <p className="field-help">This must be the same API that serves the JBR website. Database credentials stay on the server; never enter or bundle them in this app. HTTPS is required outside localhost.</p>
          <div className="settings-actions"><button className="button button-primary" type="submit"><Icon name="link" /> Save &amp; connect</button><button className="button button-secondary" type="button" onClick={disconnectDatabase}>Disconnect</button></div>
        </form>}
        <div className="setup-inline"><span className="setup-step">1</span><span>{localDemoOnly ? "Use Export backup below to save or move a copy of this device's demo catalog." : "The existing website API uses its configured database. Do not create a second catalog or paste its database URL into the APK."}</span></div>
      </section>
      {canChangePassword && <section className="panel settings-card">
        <div className="settings-card-heading"><span className="settings-large-icon database-icon"><Icon name="lock" /></span><div><h2>Change administrator password</h2><p>Verify your current password before setting a new one.</p></div></div>
        <form className="settings-form" onSubmit={submitPasswordChange}>
          <label className="field-label" htmlFor="current-admin-password">Current password</label><input className="text-input" id="current-admin-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <label className="field-label" htmlFor="new-admin-password">New password</label><input className="text-input" id="new-admin-password" type="password" autoComplete="new-password" minLength={12} maxLength={256} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <label className="field-label" htmlFor="confirm-admin-password">Confirm new password</label><input className="text-input" id="confirm-admin-password" type="password" autoComplete="new-password" minLength={12} maxLength={256} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          <p className="field-help">Use at least 12 characters. Changing the password revokes all refresh sessions; existing short-lived access tokens expire within 15 minutes. You will need to sign in again here.</p>
          {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
          <div className="settings-actions"><button className="button button-primary" type="submit" disabled={changingPassword}><Icon name="lock" />{changingPassword ? "Changing…" : "Change password"}</button></div>
        </form>
      </section>}
      <section className="panel settings-card">
        <div className="settings-card-heading"><span className="settings-large-icon cloud-icon"><Icon name="image" /></span><div><h2>Cloudinary image storage</h2><p>Upload optimized product photos directly to your Cloudinary account.</p></div><span className={`integration-state ${settings.cloudName && settings.uploadPreset ? "is-connected" : ""}`}>{settings.cloudName && settings.uploadPreset ? "Ready" : "Not connected"}</span></div>
        <form className="settings-form" onSubmit={saveCloud}>
          <label className="field-label" htmlFor="cloud-name">Cloud name</label><input className="text-input" id="cloud-name" type="text" placeholder="your-cloud-name" autoComplete="off" value={settings.cloudName} onChange={(event) => update("cloudName", event.target.value)} />
          <label className="field-label" htmlFor="upload-preset">Unsigned upload preset</label><input className="text-input" id="upload-preset" type="text" placeholder="jbr_products" autoComplete="off" value={settings.uploadPreset} onChange={(event) => update("uploadPreset", event.target.value)} />
          <p className="field-help">Create an <strong>unsigned</strong> upload preset in Cloudinary. Uploads are limited to image files up to 8 MB.</p>
          <div className="settings-actions"><button className="button button-primary" type="submit"><Icon name="save" /> Save image settings</button><button className="button button-secondary" type="button" onClick={() => { update("cloudName", ""); update("uploadPreset", ""); notify("Clear the Cloudinary fields and save to remove these settings."); }}>Clear</button></div>
        </form>
      </section>
      <section className="panel setup-guide">
        <div className="guide-heading"><span className="settings-large-icon guide-icon"><Icon name="book" /></span><div><h2>{localDemoOnly ? "About local demo mode" : "Getting your store online"}</h2><p>{localDemoOnly ? "This build does not connect to the live shop." : "Three quick steps to connect the catalog to your website."}</p></div><a href="./README.md" className="guide-link" target="_blank" rel="noreferrer">Full setup guide <span aria-hidden="true">↗</span></a></div>
        {localDemoOnly
          ? <div className="guide-steps"><div className="guide-step"><span>01</span><div><strong>Manage this device's catalog</strong><p>Products are stored locally on this device and remain separate from the live website catalog.</p></div></div><div className="guide-step"><span>02</span><div><strong>Export a backup</strong><p>Use Catalog backup to export JSON before clearing app data or changing devices.</p></div></div><div className="guide-step"><span>03</span><div><strong>Restore live service later</strong><p>Rebuild without VITE_LOCAL_DEMO_MODE after the protected production API is ready.</p></div></div></div>
          : publicCatalogWrites
            ? <div className="guide-steps"><div className="guide-step"><span>01</span><div><strong>Deploy the API opt-in</strong><p>Set ENABLE_PUBLIC_CATALOG_WRITES=true on the API host and deploy. Keep the API rate limit enabled.</p></div></div><div className="guide-step"><span>02</span><div><strong>Connect to the shared database</strong><p>Use the API that serves the website, with its existing database configuration. The APK never connects directly to PostgreSQL.</p></div></div><div className="guide-step"><span>03</span><div><strong>Accept the public access risk</strong><p>No login is required: anyone who can reach the API may update or delete products in the live catalog.</p></div></div></div>
            : <div className="guide-steps"><div className="guide-step"><span>01</span><div><strong>Deploy the protected backend</strong><p>Deploy the API to the same database used by the website and configure ADMIN_EMAIL and ADMIN_PASSWORD in the host's private environment settings.</p></div></div><div className="guide-step"><span>02</span><div><strong>Sign in with your admin credentials</strong><p>The API supplies the configured email to prefill sign-in, checks your password, and issues a short-lived session. The password is not saved on the device or included in the APK.</p></div></div><div className="guide-step"><span>03</span><div><strong>Configure Cloudinary once</strong><p>Save the cloud name and unsigned upload preset here, or bake them into a shared APK build to enable new image uploads.</p></div></div></div>}
        <div className="guide-footer"><Icon name="lock" /> Database credentials and signing secrets stay on the backend, never in the APK.</div>
      </section>
      <section className="panel data-tools-card"><div><h2>Catalog backup</h2><p>Export or restore your product data as a JSON file.</p></div><div className="data-tools-actions"><button className="button button-secondary" onClick={exportJson}><Icon name="download" /> Export backup</button><label className="button button-secondary import-button"><Icon name="upload" /> Import backup<input type="file" accept="application/json,.json" hidden onChange={importCatalog} /></label></div></section>
    </div>
  </section>;
}

function ProductDialog({ product, categories, mode, settings, onClose, onSave, onUploadImage, onTakePhoto, notify }: {
  product: Product | null;
  categories: string[];
  mode: "demo" | "remote";
  settings: AppSettings;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>, imageSetter: (url: string) => void) => Promise<void>;
  onTakePhoto: (imageSetter: (url: string) => void) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const editing = Boolean(product);
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cloudReady = Boolean(settings.cloudName && settings.uploadPreset);
  const cameraPickerRef = useRef<HTMLInputElement>(null);

  const takePhoto = () => {
    if (Capacitor.isNativePlatform()) {
      void onTakePhoto(setImageUrl);
    } else {
      cameraPickerRef.current?.click();
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const price = Number(form.get("price"));
    const stock = Number(form.get("stock"));
    if (!name || !category) {
      setError("Enter a product name and category.");
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Price must be zero or more, and stock must be a whole number of zero or more.");
      return;
    }
    const suppliedUrl = String(form.get("image_url") ?? "").trim() || imageUrl;
    if (suppliedUrl && !suppliedUrl.startsWith("data:image/")) {
      try {
        const url = new URL(suppliedUrl);
        if (url.protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a valid HTTPS product image URL.");
        return;
      }
    }
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const next: Product = {
      id: product?.id ?? makeId(),
      name,
      sku: String(form.get("sku") ?? "").trim(),
      category,
      description: String(form.get("description") ?? "").trim(),
      price,
      stock,
      image_url: suppliedUrl,
      active: Boolean(form.get("active")),
      created_at: product?.created_at ?? now,
      updated_at: now,
    };
    try {
      await onSave(next);
      notify(editing ? "Product updated successfully." : "Product added to your catalog.");
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this product.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
      <div className="dialog-header"><div><span className="dialog-eyebrow">YOUR PRODUCT CATALOG</span><h2 id="product-dialog-title">{editing ? "Edit product" : "Add a product"}</h2></div><button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="form-field full-width"><label className="field-label" htmlFor="product-name">Product name <span className="required">*</span></label><input className="text-input" id="product-name" name="name" maxLength={120} placeholder="e.g. 20A Double Pole Switch" defaultValue={product?.name ?? ""} required autoFocus /></div>
          <div className="form-field"><label className="field-label" htmlFor="product-sku">SKU / product code</label><input className="text-input" id="product-sku" name="sku" maxLength={60} placeholder="e.g. JBR-SW-020" defaultValue={product?.sku ?? ""} /></div>
          <div className="form-field"><label className="field-label" htmlFor="product-category">Category <span className="required">*</span></label><input className="text-input" id="product-category" name="category" maxLength={60} list="category-options" placeholder="e.g. Switches" defaultValue={product?.category ?? ""} required /><datalist id="category-options">{categories.map((category) => <option value={category} key={category} />)}</datalist></div>
          <div className="form-field"><label className="field-label" htmlFor="product-price">Price (₹) <span className="required">*</span></label><div className="price-input"><span>₹</span><input className="text-input" id="product-price" name="price" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={product?.price ?? ""} required /></div></div>
          <div className="form-field"><label className="field-label" htmlFor="product-stock">Stock quantity <span className="required">*</span></label><input className="text-input" id="product-stock" name="stock" type="number" min="0" step="1" placeholder="0" defaultValue={product?.stock ?? ""} required /></div>
          <div className="form-field full-width">
            <label className="field-label">Product image</label>
            <div className="image-upload-row">
              <ProductPhoto product={{ name: "Image preview", image_url: imageUrl }} className="image-preview" />
              <div className="upload-copy">
                <strong>{imageUrl ? "Product image selected" : "Add a product photo"}</strong>
                <p>{cloudReady ? "JPEG, PNG, WebP or AVIF, up to 8 MB. Stored in Cloudinary." : mode === "remote" ? "Connect Cloudinary in Settings before uploading a photo." : "JPEG, PNG, WebP or AVIF, up to 8 MB. Stored in this browser."}</p>
                <div className="upload-actions">
                  <button className="button button-primary button-small camera-button" type="button" onClick={takePhoto} disabled={(mode === "remote" && !cloudReady) || saving}>
                    <Icon name="camera" /> Take photo
                  </button>
                  <label className={`button button-secondary button-small upload-label ${mode === "remote" && !cloudReady ? "is-disabled" : ""}`}>
                    <Icon name="upload" /> Choose image
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={(mode === "remote" && !cloudReady) || saving} onChange={(event) => void onUploadImage(event, setImageUrl)} />
                  </label>
                  {imageUrl && <button className="text-button" type="button" onClick={() => setImageUrl("")}>Remove image</button>}
                </div>
              </div>
            </div>
            <input ref={cameraPickerRef} className="native-camera-fallback" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-label="Take a product photo" disabled={(mode === "remote" && !cloudReady) || saving} onChange={(event) => void onUploadImage(event, setImageUrl)} />
            <label className="field-label image-url-label" htmlFor="product-image-url">Or paste an image URL</label>
            <input className="text-input" id="product-image-url" name="image_url" type="url" placeholder="https://…" value={imageUrl.startsWith("data:") ? "" : imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </div>
          <div className="form-field full-width"><label className="field-label" htmlFor="product-description">Description</label><textarea className="text-input text-area" id="product-description" name="description" rows={3} maxLength={1000} placeholder="Tell customers what makes this product right for their project." defaultValue={product?.description ?? ""} /></div>
        </div>
        <label className="publish-toggle" htmlFor="product-active"><input id="product-active" name="active" type="checkbox" defaultChecked={product?.active ?? true} /><span className="toggle-track"><span /></span><span><strong>Publish on storefront</strong><small>Published products are visible to website visitors.</small></span></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="dialog-footer"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}><Icon name="save" />{saving ? "Saving…" : "Save product"}</button></div>
      </form>
    </section>
  </div>;
}

function LoginDialog({ onSignIn, onRegister, loading, error, email, setEmail, password, setPassword, registrationAvailable }: {
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>, registrationCode: string) => void;
  loading: boolean;
  error: string;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  registrationAvailable: boolean;
}) {
  const [registering, setRegistering] = useState(false);
  const [registrationCode, setRegistrationCode] = useState("");

  return <div className="modal-backdrop login-backdrop"><section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <a className="brand login-brand" href="/" aria-label="Back to storefront"><BrandMark /><span className="brand-copy"><strong>JBR <span>Electrical</span></strong><small>ADMIN PANEL</small></span></a>
    <div className="login-art"><span className="login-bolt"><Icon name="bolt" /></span><span className="login-art-label">STORE MANAGEMENT</span></div>
    <div className="login-content">
      <span className="dialog-eyebrow">ADMIN ACCESS</span>
      <h1 id="login-title">{registering ? "Create admin account" : <>Welcome back<span className="heading-period">.</span></>}</h1>
      <p>{registering ? "Set up the first administrator account using the one-time setup code." : "Enter your admin email and password to access the store management panel."}</p>
      <form onSubmit={(event) => registering ? onRegister(event, registrationCode) : onSignIn(event)}>
        <label className="field-label" htmlFor="login-email">Email</label>
        <input className="text-input" id="login-email" type="email" inputMode="email" autoCapitalize="none" autoComplete="username" placeholder="Admin email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="field-label" htmlFor="login-password">Password</label>
        <input className="text-input" id="login-password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 12 : undefined} maxLength={256} placeholder={registering ? "At least 12 characters" : "Admin password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {registering && <>
          <label className="field-label" htmlFor="registration-code">One-time setup code</label>
          <input className="text-input" id="registration-code" type="password" autoComplete="off" placeholder="ADMIN_REGISTRATION_CODE from server environment" value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value)} required />
        </>}
        {error && <div className="form-error login-error" role="alert">{error}</div>}
        <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? "Please wait…" : registering ? "Create admin account" : "Sign in"} <span aria-hidden="true">→</span></button>
      </form>
      {registrationAvailable && <button className="signup-toggle" type="button" onClick={() => { setRegistering((current) => !current); setRegistrationCode(""); }}>
        {registering ? <>Already registered? <strong>Sign in</strong></> : <>First time? <strong>Register as administrator</strong></>}
      </button>}
      <p className="login-security"><Icon name="lock" /> Your sign-in stays active on this device until you sign out.</p>
      <a className="login-back-link" href="/">← Back to storefront</a>
    </div>
  </section></div>;
}

function downloadFile(filename: string, contents: string, mimeType: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function compressImage(file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not process the selected image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", 0.76);
    if (compressed.length > 1_500_000) throw new Error("This image is too large for local demo storage. Connect Cloudinary or choose a smaller image.");
    return compressed;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default App;
