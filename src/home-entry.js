import { renderSiteShell } from "./components/site-shell.js";
import { applyMetadata } from "./seo/metadata.js";
import "./scenes/home-bloom-scene.js";
import "./scroll-experience.js";

renderSiteShell();
applyMetadata({
  title: "Intelligent Software",
  description:
    "From high-converting web applications to bespoke AI automation, Medhavat engineers custom digital solutions that help startups and enterprises scale faster.",
  answer:
    "Medhavat is an AI-powered digital transformation partner that builds custom software, web applications, and intelligent automation for scaling businesses.",
});
