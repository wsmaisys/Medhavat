# Medhavat

Production website in progress for Medhavat, an AI-powered digital transformation partner. The authoritative content and brand source is `public/documents/Medhavat_Brand_and_Content_Book.pdf`.

## Current status

- Baseline: static HTML pages with locally imported Three.js `0.169.0` modules.
- Home visual scene: `index.html` + `src/scenes/home-bloom-scene.js`.
- Existing service visual scenes: `src/scenes/service-ai-scene.js` and `src/scenes/service-web-scene.js`.
- Brand/content extraction: complete. The PDF defines the messaging, four service buckets, four industries, six delivery steps, and conversion form.
- Application architecture: shared content, shell, and token modules are now in `src/`; the remaining pages will be migrated incrementally.
- Scene lifecycle: the home scene and dedicated service scenes now use cancellable animation, `ResizeObserver` sizing, and `dispose()` cleanup on `pagehide`. The prepared AI and web prototypes still need migration to the shared service lifecycle contract.
- Security baseline: `vite.config.js` applies local dev/preview response headers; `public/_headers` contains the production static-host policy. The policy forbids external scripts, frames, objects, fonts, and connections, and enables HSTS, `X-Frame-Options`, COOP, CORP, Referrer-Policy, Permissions-Policy, and MIME sniffing protection.
- SEO/AEO baseline: `src/seo/metadata.js` generates canonical, Open Graph, Twitter, robots, Organization, WebSite, BreadcrumbList, and answer-oriented WebPage JSON-LD metadata.
- Logo baseline: `src/components/Logo.js` renders the local `public/images/Medhavat_logo.jpeg` fallback through a configurable image component and supports future vector or canvas renderers.
- Service pages: four dedicated service routes are now implemented under `pages/services/`, each with its own Three.js hero canvas and PDF-grounded answer block. AI reuses the prepared network/DNA scene; Digital Experience reuses the prepared console scene; Custom Engineering and Brand & Digital Growth use separate local procedural space-tech scenes.
- Brand globe: Brand & Digital Growth now loads `public/world-countries.geojson` locally and projects country boundaries onto the animated globe, with connected regional nodes, moving route packets, discovery rings, and scalable orbit rings.
- Background particles: the Brand & Digital Growth scene now renders its 420 floating background particles as instanced spheres while preserving the existing particle size, placement, opacity, and motion.
- Space-tech icons: service capability chips temporarily use animated Font Awesome glyphs from cdnjs. This is an explicit development exception requested for visual exploration; before production, extract only the used glyph/font subset into `public/fonts/` and remove the CDN links and CSP allowances. Existing local service imagery remains available for future below-the-fold content.

## Repository layout

```text
/
|-- index.html                         Active home page entrypoint
|-- pages/services/                    Active service page entrypoints
|-- src/
|   |-- components/                    Shared logo, header, footer, and shell UI
|   |-- content/                       Shared navigation and PDF-grounded page copy
|   |-- scenes/                        Three.js scenes used by the active pages
|   |-- seo/                           Canonical, social, and JSON-LD metadata
|   |-- styles/                        Shared design tokens and page styles
|   |-- *-entry.js                     Small page bootstraps that connect HTML to modules
|-- public/
|   |-- images/                        Browser-served brand, project, and service imagery
|   |-- images/service-icons/          Local service icon assets
|   |-- documents/                     Brand and content source PDF
|   |-- world-countries.geojson        Local country boundaries for the brand globe
|   |-- _headers                        Production static-host security headers
|-- vendor/three/                      Locally bundled Three.js runtime and add-ons
|-- docs/prototypes/                   Archived experiments, demos, and prototype bundles
|-- vite.config.js                     Multi-page Vite inputs and dev/preview headers
|-- package.json                       Scripts and dependency manifest
|-- .gitignore                         Files excluded from Git, such as dist/ and node_modules/
`-- .gitattributes                     Shared text line-ending and binary-file rules
```

### How a page works

Each active page has an HTML entrypoint. That HTML loads its page stylesheet and one small `src/*-entry.js` bootstrap. The bootstrap renders the shared shell, applies route metadata, and starts the page’s Three.js scene from `src/scenes/`. Scenes import the local runtime from `vendor/three/` and load browser-facing data from `public/` using root-relative URLs. Vite discovers the five configured HTML entrypoints and writes the production bundle to `dist/`.

### Where to make changes

- Change navigation, shared header/footer, or the logo in `src/components/`.
- Change shared copy or route navigation in `src/content/site-content.js`.
- Change page titles, canonical URLs, or structured data in `src/seo/metadata.js` and the relevant entrypoint.
- Change a visual experience in the matching file under `src/scenes/`.
- Change colors, spacing, typography, or responsive layout in `src/styles/`.
- Add browser-served images, icons, or data under `public/` and reference them with a root-relative path such as `/images/example.jpg`.
- Keep experiments in `docs/prototypes/`; they are reference material, not part of the active Vite build.

## Run the current prototype

Use the Vite development server because ES modules and asset loading are not reliable from `file://`:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. No CDN, remote font, or remote asset should be added.

## Routing blueprint

| Route                          | Page purpose                | PDF-grounded content                                                          | Three.js experience                                                       |
| ------------------------------ | --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/`                            | Home                        | Hero, friction vs transformation, service buckets, trust bar, industries, CTA | Mirrored crystalline energy portals from `src/scenes/home-bloom-scene.js` |
| `/services`                    | Service overview            | Four strategic service buckets                                                | Service constellation overview                                            |
| `/services/digital-experience` | Digital Experience & Web    | Web development, e-commerce, PWA, UI/UX redesign                              | Flowing interface/grid system                                             |
| `/services/custom-engineering` | Custom Engineering          | Enterprise software, mobile, SaaS architecture, APIs                          | Modular systems architecture                                              |
| `/services/ai-automation`      | AI & Intelligent Automation | AI agents, chatbots, RAG, predictive analytics, process automation            | Existing network/DNA scene                                                |
| `/services/brand-growth`       | Brand & Digital Growth      | Brand systems, technical SEO, performance, support                            | Signal/graph growth scene                                                 |
| `/industries`                  | Industry Solutions          | Healthcare, Finance & Fintech, Retail & E-commerce, Real Estate & Logistics   | Industry impact matrix visualization                                      |
| `/process`                     | Development Process         | Discovery through Launch & Growth Support, six steps                          | Progressive six-stage pipeline                                            |
| `/work`                        | Insights & Work             | Case studies, outcomes, and insight content surface                           | Interactive project/work index                                            |
| `/contact`                     | Strategy consultation       | Form headline, required fields, project scopes, budget ranges                 | Calm low-motion consultation backdrop                                     |

## Brand rules from the PDF

- Positioning: "The end-to-end technology & AI partner for scaling businesses."
- Tagline: "Intellectual Tech. Real Business Growth."
- Voice: confident, approachable, direct, and outcome-focused; avoid corporate jargon.
- Primary slate: `#0F172A`. Electric cyan: `#00D2FF`. Emerald CTA: `#10B981`. Off-white: `#F8FAFC`. White: `#FFFFFF`. Borders: `#E2E8F0`.
- Headings: Plus Jakarta Sans or Outfit. Body: Inter or DM Sans. Font files must be hosted locally before use.
- Reserve emerald for conversion actions. Prefer UI mockups, workflow diagrams, and stat badges over generic stock photography.

## Implementation sequence

1. [x] Add local Vite development/build commands and route the root entry through Vite.
2. [x] Extract shared tokens, header/footer/navigation, and PDF-grounded content into `src/`.
3. [x] Add the centralized metadata/schema generator and security header baseline.
4. [ ] Create the remaining non-service multi-page entries and apply metadata/schema to each route.
5. [x] Add `ResizeObserver`, cancellable animation, and complete `dispose()` cleanup to `src/scenes/home-bloom-scene.js`.
6. [ ] Migrate the prepared AI and web prototypes to the shared scene lifecycle contract.
7. [x] Add four dedicated service routes with local animated space-tech capability motifs.
8. [ ] Add the remaining industry, process, work, and contact routes with one dedicated local scene per page.
9. [ ] Validate keyboard/mobile UX, local asset loading, schema output, WebGL fallback, and PageSpeed targets.

## Security standards

- Production must be HTTPS-only and send HSTS only after TLS is active for the full domain and subdomains.
- Client JavaScript must not create cookies. Any future server cookie must be `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter), and scoped with `Path=/`.
- Forms must use native constraints plus server-side validation and allowlisted values. Never place raw user input into `innerHTML`, URLs, HTML attributes, or JSON-LD.
- CORS remains same-origin by default. The static policy only allows the canonical production origin and read methods; API-specific CORS must be configured on the API server.
- The migrated home route has no external CDN, inline script, inline style, frame, object, or external font source. Service routes temporarily allow cdnjs for icon exploration only; remove that allowance before production deployment.

## SEO/AEO standards

- Every route must use `applyMetadata()` with a unique title, description, canonical path, and concise answer block where appropriate.
- Every route must contain semantic `<header>`, `<nav>`, `<main>`, `<section>` or `<article>`, and `<footer>` landmarks.
- JSON-LD must remain truthful to the PDF-grounded service and organization content. Add `Service` nodes on service routes and `BreadcrumbList` entries for nested routes.
- Answer blocks should state the page's direct business answer in one or two concise sentences before supporting detail, so search crawlers and conversational retrieval systems can quote the page accurately.

## Local Three.js files

The repository already contains corrected local copies of the required Three.js core, controls, postprocessing passes, shaders, fonts, and model loaders under `vendor/three/`. Keep imports relative to those files; do not reintroduce CDN or bare-module browser imports.
