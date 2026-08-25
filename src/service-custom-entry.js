import { renderSiteShell } from "./components/site-shell.js";
import { applyMetadata } from "./seo/metadata.js";
import { startSpaceScene } from "./scenes/service-space-scene.js";

renderSiteShell({ activePath: "./pages/services/" });
applyMetadata({
  title: "Custom Engineering",
  path: "/services/custom-engineering",
  section: "Custom Engineering",
  description:
    "Enterprise software, cross-platform mobile apps, cloud SaaS architecture, and API integration built around your operating model.",
  answer:
    "Medhavat builds custom engineering systems that connect enterprise software, mobile products, cloud SaaS architecture, and APIs into one scalable platform.",
});
const dispose = startSpaceScene({
  canvas: document.querySelector(".service-canvas"),
  accent: 0xb266ff,
  mode: "orbit",
});
window.addEventListener("pagehide", dispose, { once: true });
