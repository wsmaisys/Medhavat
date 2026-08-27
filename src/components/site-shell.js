import { brand, company, serviceBuckets } from "../content/site-content.js";
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
    const menu = document.createElement("details");
    menu.className = "services-menu";
    const summary = document.createElement("summary");
    summary.textContent = "Services";
    menu.append(summary);
    const menuPanel = document.createElement("div");
    menuPanel.className = "services-menu-panel";
    serviceBuckets.forEach(({ slug, title }) => {
      const link = document.createElement("a");
      link.href = `/pages/services/${slug}.html`;
      link.textContent = title;
      if (activePath === link.getAttribute("href")) {
        link.setAttribute("aria-current", "page");
      }
      menuPanel.append(link);
    });
    menu.append(menuPanel);
    nav.append(menu);

    const cta = document.createElement("a");
    cta.className = "site-cta";
    cta.href = "/pages/contact.html";
    cta.textContent = "Get Started";
    header.append(nav, cta);
  }

  if (footer) {
    footer.replaceChildren();
    const name = document.createElement("span");
    name.textContent = brand.name;
    const tagline = document.createElement("span");
    tagline.textContent = brand.tagline;
    const contact = document.createElement("span");
    contact.textContent = `${company.contact.email} | ${company.contact.phone}`;
    footer.append(name, tagline, contact);
  }
}
