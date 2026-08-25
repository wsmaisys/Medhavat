import { brand, navigation } from "../content/site-content.js";
import { renderLogo } from "./Logo.js";

export function renderSiteShell({ activePath = "" } = {}) {
  const header = document.querySelector("[data-site-header]");
  const footer = document.querySelector("[data-site-footer]");

  if (header) {
    header.replaceChildren();
    header.append(renderLogo({ href: "/", label: `${brand.name} home` }));

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "Primary navigation");
    navigation.forEach(({ label, href }) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (activePath === href) link.setAttribute("aria-current", "page");
      nav.append(link);
    });

    const cta = document.createElement("a");
    cta.className = "site-cta";
    cta.href = "/pages/contact.html";
    cta.textContent = "Book Strategy Call";
    header.append(nav, cta);
  }

  if (footer) {
    footer.replaceChildren();
    const name = document.createElement("span");
    name.textContent = brand.name;
    const tagline = document.createElement("span");
    tagline.textContent = brand.tagline;
    footer.append(name, tagline);
  }
}
