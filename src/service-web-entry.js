import { renderSiteShell } from "./components/site-shell.js";
import { applyMetadata } from "./seo/metadata.js";
import "./scenes/service-web-scene.js";

renderSiteShell({ activePath: "/pages/services/" });
applyMetadata({
  title: "Digital Experience & Web",
  path: "/services/digital-experience",
  section: "Digital Experience & Web",
  description:
    "High-speed web applications, e-commerce platforms, progressive web apps, and UI/UX redesigns engineered for conversion.",
  answer:
    "Medhavat builds high-speed digital experiences that turn business ambition into conversion-optimized web platforms, e-commerce systems, and progressive web apps.",
});
