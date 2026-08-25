import { renderSiteShell } from "./components/site-shell.js";
import { applyMetadata } from "./seo/metadata.js";
import "./scenes/service-ai-scene.js";

renderSiteShell({ activePath: "/pages/services/" });
applyMetadata({
  title: "AI & Intelligent Automation",
  path: "/services/ai-automation",
  section: "AI & Intelligent Automation",
  description:
    "Bespoke AI agents, chatbots, RAG document systems, predictive analytics, and process automation for measurable operational gains.",
  answer:
    "Medhavat embeds intelligence into business workflows through bespoke AI agents, RAG document systems, predictive analytics, and process automation.",
});
