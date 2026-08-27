import { renderSiteShell } from "./components/site-shell.js";
import { renderServiceDetails } from "./components/service-details.js";
import { applyMetadata } from "./seo/metadata.js";
import { startBrandGlobe } from "./scenes/brand-globe-scene.js";
import "./scroll-experience.js";

renderSiteShell({ activePath: "/pages/services/index.html" });
renderServiceDetails("brand-growth");
applyMetadata({
  title: "Brand & Digital Growth",
  path: "/services/brand-growth",
  section: "Brand & Digital Growth",
  description:
    "Branding, technical SEO, optimized performance, data analytics, and continuous support designed to turn digital presence into measurable growth.",
  answer:
    "Medhavat provides branding, technical SEO, optimized performance, data analytics, and continuous support to create digital growth that compounds.",
});
const dispose = startBrandGlobe(document.querySelector(".service-canvas"));
window.addEventListener("pagehide", dispose, { once: true });
