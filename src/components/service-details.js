import { serviceBuckets } from "../content/site-content.js";

export function renderServiceDetails(slug) {
  const bucket = serviceBuckets.find((service) => service.slug === slug);
  const target = document.querySelector("[data-service-details]");
  if (!bucket || !target) return;

  target.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "What we build for you";
  target.append(heading);

  const grid = document.createElement("div");
  grid.className = "service-detail-grid";
  bucket.items.forEach(([title, description], index) => {
    const item = document.createElement("article");
    item.className = "service-detail-card";
    item.innerHTML = `<p>0${index + 1}</p><h3>${title}</h3><strong>${description}</strong>`;
    grid.append(item);
  });
  target.append(grid);
}
