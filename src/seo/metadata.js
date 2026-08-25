import { brand } from "../content/site-content.js";

const SITE_ORIGIN = "https://www.medhavat.com";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.append(element);
  }
  element.href = href;
}

function upsertJsonLd(id, data) {
  let element = document.head.querySelector(`#${id}`);
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.append(element);
  }
  element.textContent = JSON.stringify(data);
}

export function applyMetadata({
  title,
  description,
  path = "/",
  type = "website",
  section = "",
  answer = "",
} = {}) {
  const canonical = new URL(path, SITE_ORIGIN).href;
  const fullTitle = title ? `${title} | ${brand.name}` : brand.name;
  document.title = fullTitle;

  upsertMeta("name", "description", description || brand.positioning);
  upsertMeta("name", "robots", "index, follow");
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:title", fullTitle);
  upsertMeta("property", "og:description", description || brand.positioning);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:site_name", brand.name);
  upsertMeta("name", "twitter:card", "summary");
  upsertMeta("name", "twitter:title", fullTitle);
  upsertMeta("name", "twitter:description", description || brand.positioning);
  upsertLink("canonical", canonical);

  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: brand.name,
      url: SITE_ORIGIN,
      slogan: brand.tagline,
      description: brand.positioning,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      name: brand.name,
      url: SITE_ORIGIN,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
        ...(section
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: section,
                item: canonical,
              },
            ]
          : []),
      ],
    },
  ];

  if (answer) {
    graph.push({
      "@type": "WebPage",
      url: canonical,
      name: fullTitle,
      abstract: answer,
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["[data-answer]"],
      },
    });
  }

  upsertJsonLd("medhavat-jsonld", {
    "@context": "https://schema.org",
    "@graph": graph,
  });
}
