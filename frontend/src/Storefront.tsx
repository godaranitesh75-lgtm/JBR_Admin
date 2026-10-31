import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image_data: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CartItem = { product: Product; quantity: number };
type ToastMessage = { id: number; message: string; error: boolean };

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_PUBLIC_API_URL ?? "").replace(/\/+$/, "").replace(/\/api$/, "");
const WHATSAPP_NUMBER = "916377374179";
const STORE_NAME = "JBR Electrical";
const STORE_ADDRESS = "Troop Bazaar, Koti, Hyderabad";
const STORE_PHONE = "6377374179";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount || 0);
}

function plural(count: number, singular: string, multiple = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : multiple}`;
}

function whatsappOrder(items: CartItem[]): string {
  const lines = items.map((item) => `• ${item.product.name}${item.product.sku ? ` (${item.product.sku})` : ""} × ${item.quantity} — ${formatPrice(item.product.price * item.quantity)}`);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const text = `Hello ${STORE_NAME}! I'd like to order the following:\n\n${lines.join("\n")}\n\nTotal: ${formatPrice(total)}\n\nPlease confirm availability and payment details.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function whatsappEnquire(product: Product): string {
  const text = `Hello ${STORE_NAME}! I'd like to enquire about ${product.name}${product.sku ? ` (${product.sku})` : ""}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

type IconName = "bolt" | "cart" | "check" | "chevron" | "close" | "image" | "minus"
  | "phone" | "plus" | "search" | "shop" | "whatsapp" | "alert" | "info" | "trash";

const ICONS: Record<IconName, ReactNode> = {
  alert: <><path d="m10.3 3.9-8 13.8A2 2 0 0 0 4 20.7h16a2 2 0 0 0 1.7-3l-8-13.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  bolt: <path d="m13 2-3 9h7l-6 11 1-9H5l8-11Z" />,
  cart: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  minus: <path d="M5 12h14" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.7A2 2 0 0 1 22 16.9Z" />,
  plus: <path d="M12 5v14m-7-7h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shop: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></>,
  whatsapp: <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.2-.6.9-.8 1-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.6l.4-.5c.1-.1.2-.3.3-.4.1-.2.1-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.5.2-1 .1-1.1l-.4-.2ZM12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></>,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true"
      style={{ width: "1em", height: "1em", display: "inline-block", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0 }}>
      {ICONS[name]}
    </svg>
  );
}

// ─── Product Image ─────────────────────────────────────────────────────────────

function ProductImage({ product, className }: { product: Pick<Product, "name" | "image_data">; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_data]);
  if (product.image_data && !failed) {
    return <img src={product.image_data} alt={product.name} loading="lazy" onError={() => setFailed(true)} className={className} />;
  }
  return <span className={`sf-img-fallback ${className ?? ""}`}><Icon name="image" /></span>;
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ items, onClose, onUpdate, onRemove }: {
  items: CartItem[];
  onClose: () => void;
  onUpdate: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderUrl = whatsappOrder(items);

  return (
    <div className="sf-drawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="sf-drawer">
        <div className="sf-drawer-header">
          <h2>Your cart <span className="sf-cart-count">{plural(items.reduce((s, i) => s + i.quantity, 0), "item")}</span></h2>
          <button className="sf-icon-btn" onClick={onClose} aria-label="Close cart"><Icon name="close" /></button>
        </div>

        {items.length === 0 ? (
          <div className="sf-drawer-empty">
            <span className="sf-empty-icon"><Icon name="cart" /></span>
            <strong>Your cart is empty</strong>
            <p>Add products and send a WhatsApp order to JBR Electrical.</p>
          </div>
        ) : (
          <>
            <ul className="sf-cart-list">
              {items.map((item) => (
                <li key={item.product.id} className="sf-cart-item">
                  <div className="sf-cart-thumb">
                    <ProductImage product={item.product} />
                  </div>
                  <div className="sf-cart-info">
                    <strong>{item.product.name}</strong>
                    {item.product.sku && <small>{item.product.sku}</small>}
                    <span className="sf-cart-price">{formatPrice(item.product.price)}</span>
                  </div>
                  <div className="sf-cart-qty">
                    <button className="sf-qty-btn" onClick={() => onUpdate(item.product.id, item.quantity - 1)} aria-label="Decrease quantity" disabled={item.quantity <= 1}>
                      <Icon name="minus" />
                    </button>
                    <span>{item.quantity}</span>
                    <button className="sf-qty-btn" onClick={() => onUpdate(item.product.id, item.quantity + 1)} aria-label="Increase quantity">
                      <Icon name="plus" />
                    </button>
                  </div>
                  <button className="sf-remove-btn" onClick={() => onRemove(item.product.id)} aria-label={`Remove ${item.product.name}`}>
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="sf-cart-footer">
              <div className="sf-cart-total">
                <span>Total</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <p className="sf-cart-note">Prices are indicative. JBR Electrical will confirm final pricing and availability via WhatsApp.</p>
              <a className="sf-order-btn" href={orderUrl} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" /> Order via WhatsApp
              </a>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ─── Product Modal ─────────────────────────────────────────────────────────────

function ProductModal({ product, onClose, onAddToCart }: {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const inStock = product.stock > 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="sf-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sf-modal" role="dialog" aria-modal="true" aria-labelledby="prod-modal-title">
        <button className="sf-modal-close sf-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <div className="sf-modal-inner">
          <div className="sf-modal-image">
            <ProductImage product={product} />
          </div>
          <div className="sf-modal-details">
            <span className="sf-modal-category">{product.category}</span>
            <h2 id="prod-modal-title">{product.name}</h2>
            {product.sku && <p className="sf-modal-sku">SKU: {product.sku}</p>}
            {product.description && <p className="sf-modal-desc">{product.description}</p>}
            <div className="sf-modal-price">{formatPrice(product.price)}</div>
            <p className={`sf-modal-stock ${inStock ? "in-stock" : "out-of-stock"}`}>
              {inStock ? `${product.stock} in stock` : "Currently out of stock"}
            </p>

            {inStock && (
              <div className="sf-modal-actions">
                <div className="sf-modal-qty">
                  <button className="sf-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Icon name="minus" /></button>
                  <span>{qty}</span>
                  <button className="sf-qty-btn" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}><Icon name="plus" /></button>
                </div>
                <button className="sf-add-btn" onClick={() => { onAddToCart(product, qty); onClose(); }}>
                  <Icon name="cart" /> Add to cart
                </button>
              </div>
            )}

            <a className="sf-enquire-btn" href={whatsappEnquire(product)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" /> {inStock ? "Enquire via WhatsApp" : "Ask about availability"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Storefront App ───────────────────────────────────────────────────────

type AuthSession = {
  email: string;
  token: string;
};

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Authentication state
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const notify = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, error }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3200);
  }, []);

  // Check for saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem("jbr-customer-session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AuthSession;
        if (parsed.email && parsed.token) {
          setSession(parsed);
        }
      } catch {
        localStorage.removeItem("jbr-customer-session");
      }
    }
  }, []);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      const url = API_URL ? `${API_URL}/api/auth/customer-login` : "/api/auth/customer-login";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error((data as { error?: string }).error || "Invalid email or password");
      }

      const data = await response.json() as { access_token: string; user: { email: string } };
      const newSession = { email: data.user.email, token: data.access_token };
      
      localStorage.setItem("jbr-customer-session", JSON.stringify(newSession));
      setSession(newSession);
      setLoginEmail("");
      setLoginPassword("");
      notify("Welcome to JBR Electrical!");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoggingIn(false);
    }
  };

  // Register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    if (loginPassword.length < 8) {
      setLoginError("Password must be at least 8 characters");
      return;
    }
    
    setLoggingIn(true);

    try {
      const url = API_URL ? `${API_URL}/api/auth/customer-register` : "/api/auth/customer-register";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          name: registerName,
          phone: registerPhone,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Registration failed" }));
        throw new Error((data as { error?: string }).error || "Could not create account");
      }

      const data = await response.json() as { access_token: string; user: { email: string } };
      const newSession = { email: data.user.email, token: data.access_token };
      
      localStorage.setItem("jbr-customer-session", JSON.stringify(newSession));
      setSession(newSession);
      setLoginEmail("");
      setLoginPassword("");
      setRegisterName("");
      setRegisterPhone("");
      notify("Account created! Welcome to JBR Electrical!");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("jbr-customer-session");
    setSession(null);
    setCart([]);
    notify("Signed out successfully");
  };

  // Fetch products (only when logged in)
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const url = API_URL ? `${API_URL}/api/products` : "/api/products";
    fetch(url, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          // Token expired
          localStorage.removeItem("jbr-customer-session");
          setSession(null);
          throw new Error("Session expired. Please sign in again.");
        }
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json() as Promise<Product[]>;
      })
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load products.");
        setLoading(false);
      });
  }, [session]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch = !q || [p.name, p.sku, p.category, p.description].some((f) => f.toLowerCase().includes(q));
      const matchCat = !categoryFilter || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = useCallback((product: Product, quantity: number) => {
    setCart((current) => {
      const existing = current.find((i) => i.product.id === product.id);
      if (existing) {
        return current.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...current, { product, quantity }];
    });
    notify(`${product.name} added to cart.`);
  }, [notify]);

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setCart((current) => current.map((i) => i.product.id === productId ? { ...i, quantity } : i));
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((i) => i.product.id !== productId));
  };

  // Close mobile menu on wider screens
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileMenuOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // If not logged in, show login form
  if (!session) {
    return (
      <div className="sf-login-page">
        <div className="sf-login-container">
          <div className="sf-login-brand">
            <span className="sf-logo-mark"><Icon name="bolt" /></span>
            <div>
              <h1>JBR Electrical</h1>
              <p>{showRegister ? "Create an account" : "Sign in to browse our products"}</p>
            </div>
          </div>

          <form className="sf-login-form" onSubmit={showRegister ? handleRegister : handleLogin}>
            {showRegister && (
              <>
                <div className="sf-form-field">
                  <label htmlFor="customer-name">Name (optional)</label>
                  <input
                    id="customer-name"
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                </div>

                <div className="sf-form-field">
                  <label htmlFor="customer-phone">Phone (optional)</label>
                  <input
                    id="customer-phone"
                    type="tel"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    placeholder="Your phone number"
                  />
                </div>
              </>
            )}

            <div className="sf-form-field">
              <label htmlFor="customer-email">Email address</label>
              <input
                id="customer-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus={!showRegister}
              />
            </div>

            <div className="sf-form-field">
              <label htmlFor="customer-password">Password</label>
              <input
                id="customer-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder={showRegister ? "At least 8 characters" : "Enter your password"}
                required
              />
            </div>

            {loginError && (
              <div className="sf-login-error">
                <Icon name="alert" />
                <span>{loginError}</span>
              </div>
            )}

            <button type="submit" className="sf-login-btn" disabled={loggingIn}>
              {loggingIn ? (showRegister ? "Creating account..." : "Signing in...") : (showRegister ? "Create account" : "Sign in")}
            </button>

            <p className="sf-login-note" style={{ textAlign: "center" }}>
              {showRegister ? (
                <>Already have an account? <button type="button" onClick={() => setShowRegister(false)} style={{ background: "none", border: "none", color: "var(--sf-primary)", textDecoration: "underline", cursor: "pointer" }}>Sign in</button></>
              ) : (
                <>Don't have an account? <button type="button" onClick={() => setShowRegister(true)} style={{ background: "none", border: "none", color: "var(--sf-primary)", textDecoration: "underline", cursor: "pointer" }}>Create one</button></>
              )}
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <header className="sf-header">
        <div className="sf-header-inner">
          <a href="/" className="sf-logo">
            <span className="sf-logo-mark"><Icon name="bolt" /></span>
            <span className="sf-logo-text">JBR <em>Electrical</em></span>
          </a>

          <nav className={`sf-nav ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Main navigation">
            <a href="#products" onClick={() => setMobileMenuOpen(false)}>Products</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a href={`tel:${STORE_PHONE}`} onClick={() => setMobileMenuOpen(false)}><Icon name="phone" /> Call us</a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="sf-nav-wa" onClick={() => setMobileMenuOpen(false)}>
              <Icon name="whatsapp" /> WhatsApp
            </a>
          </nav>

          <div className="sf-header-actions">
            <button className="sf-cart-btn" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} items`}>
              <Icon name="cart" />
              {cartCount > 0 && <span className="sf-cart-badge">{cartCount}</span>}
            </button>
            <button className="sf-user-btn" onClick={handleLogout} title={`Signed in as ${session.email}`}>
              <Icon name="close" />
            </button>
            <button className="sf-hamburger" onClick={() => setMobileMenuOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="sf-hero">
        <div className="sf-hero-inner">
          <div className="sf-hero-copy">
            <span className="sf-kicker">Trusted since day one</span>
            <h1>Your complete electrical supplies store</h1>
            <p>Wires, switches, bulbs, fans, circuit breakers and more — everything you need for home, office, and projects, all in one place.</p>
            <div className="sf-hero-btns">
              <a href="#products" className="sf-btn sf-btn-primary">Shop products</a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="sf-btn sf-btn-wa">
                <Icon name="whatsapp" /> Chat on WhatsApp
              </a>
            </div>
          </div>
          <div className="sf-hero-stats">
            <div className="sf-hero-stat"><strong>{products.length || "—"}</strong><span>Products</span></div>
            <div className="sf-hero-stat"><strong>{categories.length || "—"}</strong><span>Categories</span></div>
            <div className="sf-hero-stat"><strong>24/7</strong><span>WhatsApp</span></div>
          </div>
        </div>
      </section>

      {/* ── Category chips ── */}
      {categories.length > 0 && (
        <section className="sf-cats-section">
          <div className="sf-cats-inner">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`sf-cat-chip ${categoryFilter === cat ? "is-active" : ""}`}
                onClick={() => { setCategoryFilter((c) => c === cat ? "" : cat); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Products ── */}
      <section id="products" className="sf-products-section">
        <div className="sf-products-inner">
          <div className="sf-products-header">
            <div>
              <h2>{categoryFilter || "All products"}</h2>
              <p>{plural(filteredProducts.length, "product")}</p>
            </div>
            <label className="sf-search">
              <Icon name="search" />
              <input
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                aria-label="Search products"
              />
              {search && <button className="sf-search-clear" onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" /></button>}
            </label>
          </div>

          {loading && (
            <div className="sf-loader-wrap">
              <div className="sf-spinner" />
              <p>Loading products…</p>
            </div>
          )}

          {!loading && error && (
            <div className="sf-error-state">
              <Icon name="alert" />
              <strong>Could not load products</strong>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="sf-empty-state">
              <Icon name="shop" />
              <strong>{search || categoryFilter ? "No products match your search" : "No products yet"}</strong>
              {(search || categoryFilter) && (
                <button className="sf-btn sf-btn-secondary" onClick={() => { setSearch(""); setCategoryFilter(""); }}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && !error && filteredProducts.length > 0 && (
            <div className="sf-product-grid">
              {filteredProducts.map((product) => (
                <article key={product.id} className="sf-product-card" onClick={() => setModalProduct(product)}>
                  <div className="sf-product-img">
                    <ProductImage product={product} />
                    {product.stock === 0 && <span className="sf-out-badge">Out of stock</span>}
                    {product.stock > 0 && product.stock <= 5 && <span className="sf-low-badge">Only {product.stock} left</span>}
                  </div>
                  <div className="sf-product-body">
                    <span className="sf-product-cat">{product.category}</span>
                    <h3>{product.name}</h3>
                    {product.sku && <p className="sf-product-sku">{product.sku}</p>}
                    {product.description && <p className="sf-product-desc">{product.description}</p>}
                    <div className="sf-product-footer">
                      <strong className="sf-product-price">{formatPrice(product.price)}</strong>
                      <div className="sf-product-actions">
                        {product.stock > 0 ? (
                          <button
                            className="sf-add-to-cart"
                            onClick={(e) => { e.stopPropagation(); addToCart(product, 1); }}
                            aria-label={`Add ${product.name} to cart`}
                          >
                            <Icon name="cart" /> Add
                          </button>
                        ) : (
                          <a
                            className="sf-enquire-link"
                            href={whatsappEnquire(product)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="whatsapp" /> Enquire
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── About / Contact ── */}
      <section id="about" className="sf-about-section">
        <div className="sf-about-inner">
          <div className="sf-about-copy">
            <span className="sf-kicker">About us</span>
            <h2>Your trusted electrical partner</h2>
            <p>JBR Electrical is your go-to shop for quality electrical products. We stock a wide range of switches, wiring, lighting, fans, and protection equipment from trusted brands — at fair prices for homes and professionals alike.</p>
            <p>Visit us in person or reach out via WhatsApp for bulk enquiries, custom orders, or product advice.</p>
            <div className="sf-contact-cards">
              <a href={`tel:${STORE_PHONE}`} className="sf-contact-card">
                <Icon name="phone" />
                <div>
                  <strong>Call us</strong>
                  <span>{STORE_PHONE}</span>
                </div>
              </a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="sf-contact-card sf-contact-wa">
                <Icon name="whatsapp" />
                <div>
                  <strong>WhatsApp</strong>
                  <span>Chat anytime</span>
                </div>
              </a>
            </div>
          </div>
          <div className="sf-about-info">
            <div className="sf-info-card">
              <h3>Store location</h3>
              <p>{STORE_ADDRESS}</p>
              <hr />
              <h3>Why choose JBR?</h3>
              <ul>
                <li><Icon name="check" /> Genuine branded products</li>
                <li><Icon name="check" /> Competitive pricing</li>
                <li><Icon name="check" /> WhatsApp ordering</li>
                <li><Icon name="check" /> Fast delivery options</li>
                <li><Icon name="check" /> Expert product advice</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <div className="sf-footer-brand">
            <span className="sf-logo-mark"><Icon name="bolt" /></span>
            <div>
              <strong>JBR Electrical</strong>
              <span>{STORE_ADDRESS}</span>
            </div>
          </div>
          <div className="sf-footer-links">
            <a href="#products">Products</a>
            <a href="#about">About</a>
            <a href={`tel:${STORE_PHONE}`}>Call</a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="/admin">Admin</a>
          </div>
          <p className="sf-footer-copy">© {new Date().getFullYear()} JBR Electrical. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Cart Drawer ── */}
      {cartOpen && (
        <CartDrawer
          items={cart}
          onClose={() => setCartOpen(false)}
          onUpdate={updateCartQty}
          onRemove={removeFromCart}
        />
      )}

      {/* ── Product Modal ── */}
      {modalProduct && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* ── Toasts ── */}
      <div className="sf-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`sf-toast ${t.error ? "error" : ""}`}>
            <Icon name={t.error ? "alert" : "check"} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
