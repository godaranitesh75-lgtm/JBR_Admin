import React from "react";
import { createRoot } from "react-dom/client";

const isAdmin = window.location.pathname.startsWith("/admin");

if (isAdmin) {
  // ── Admin panel ── load admin styles + App
  import("../styles.css");
  import("../app-overrides.css");
  import("./App").then(({ default: App }) => {
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
} else {
  // ── Customer storefront ── load storefront styles + Storefront
  import("../storefront.css");
  import("./Storefront").then(({ default: Storefront }) => {
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <Storefront />
      </React.StrictMode>,
    );
  });
}
