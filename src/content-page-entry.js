import { renderSiteShell } from "./components/site-shell.js";
import {
  company,
  industries,
  portfolio,
  processSteps,
  serviceBuckets,
  serviceCatalog,
} from "./content/site-content.js";
import { applyMetadata } from "./seo/metadata.js";
import { startBrandGlobe } from "./scenes/brand-globe-scene.js";
import { startSpaceScene } from "./scenes/service-space-scene.js";
import "./scroll-experience.js";

const page = document.body.dataset.page;
const pageData = {
  services: {
    title: "Complete Digital Transformation Services",
    description:
      "Strategy, design, engineering, AI, and growth services that move ambitious businesses forward.",
    section: "Services",
  },
  industries: {
    title: "Digital Solutions Across Industries",
    description:
      "Flexible technology and AI solutions for healthcare, finance, retail, education, real estate, manufacturing, hospitality, logistics, and media.",
    section: "Industry Solutions",
  },
  process: {
    title: "A Proven Development Process",
    description:
      "A structured, collaborative path from business discovery to launch and continuous improvement.",
    section: "Development Process",
  },
  work: {
    title: "Work Built Around Business Results",
    description:
      "A practical view of the digital products, intelligent systems, and growth foundations Medhavat creates.",
    section: "Insights & Work",
  },
  contact: {
    title: "Ready to Transform Your Business?",
    description:
      "Get a free consultation from Medhavat's digital transformation experts.",
    section: "Contact",
  },
}[page];

renderSiteShell({ activePath: `/pages/${page}.html` });
applyMetadata({
  title: pageData.title,
  description: pageData.description,
  section: pageData.section,
});

const canvas = document.querySelector(".content-canvas");
const dispose =
  document.body.dataset.scene === "globe"
    ? startBrandGlobe(canvas)
    : startSpaceScene({
        canvas,
        accent: page === "process" ? 0x10b981 : 0x4fe0ff,
        mode: page === "work" ? "orbit" : "grid",
      });
window.addEventListener("pagehide", dispose, { once: true });

const lists = {
  services: serviceBuckets.map(({ title, items }) => ({
    title,
    body: items.join(" | "),
  })),
  industries: industries.map((name) => ({
    title: name,
    body: "Technology, automation, and digital experiences shaped around the needs of this sector.",
  })),
  process: processSteps.map((title, index) => ({
    title: `STEP ${index + 1} · ${title}`,
    body: [
      "We understand your goals and audience before building.",
      "A clear roadmap and interface direction make decisions visible.",
      "Our engineers build with scalable, maintainable foundations.",
      "We test quality, security, and performance across the experience.",
      "We deploy smoothly with documentation and handover.",
      "We monitor, improve, and support the product as it grows.",
    ][index],
  })),
  work: portfolio.map(([title, body, result]) => ({
    title,
    body: `${body} ${result}`,
  })),
};

const list = document.querySelector("[data-page-list]");
if (list && lists[page]) {
  lists[page].forEach(({ title, body }) => {
    const article = document.createElement("article");
    article.className = "content-item";
    article.innerHTML = `<h2>${title}</h2><p>${body}</p>`;
    list.append(article);
  });
}

if (page === "contact") {
  document.querySelector("[data-contact-email]").textContent =
    company.contact.email;
  document.querySelector("[data-contact-phone]").textContent =
    company.contact.phone;
}
