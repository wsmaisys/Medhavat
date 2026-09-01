# Medhavat — Intellectual Tech. Real Business Growth.

> High-performance digital transformation platform engineered for scaling enterprises. Features bespoke interactive full-page matrix dynamics, a 2×2 matrix Theme HUD (Eco-Data spectrum), and full GDPR / DPDP compliance.

---

## 🌟 Key Features & Architectural Highlights

### 1. 🎛️ Floating 2×2 Theme HUD Matrix
- **Matrix Architecture**: Switches seamlessly between `(Day, Night) × (Coloured, Greyscale)`.
  - **Night + Coloured**: Dark canvas (`#07090e`) with the **Eco-Data** palette (`#1B3863`, `#155E75`, `#0D9488`, `#14B8A6`, `#4ADE80`).
  - **Night + Greyscale**: Classic dark monochrome aesthetic.
  - **Day + Coloured**: Clean frosted daylight canvas (`#f8fafc`) with deep corporate navy, ocean teal, and vibrant turquoise accents.
  - **Day + Greyscale**: Crisp light canvas with clean slate typography and neutral glass cards.
- **Cinematic Transition Engine**:
  - **Dual-Layer Canvas RGB Morphing**: Interactive canvas background and individual binary matrix digits morph gradually over **900ms** using cubic RGB/RGBA color lerping (`lerpColor`).
  - **Origin-Aware Quantum Shockwave**: Radiates an energy ripple across the binary grid directly from the clicked HUD swatch card.
  - **Silky CSS Color Dissolve**: 850ms `cubic-bezier(0.4, 0, 0.2, 1)` easing curve across backgrounds, borders, typography, card glow shadows, and glass backdrops.
- **Floating HUD Pill**: Glassmorphic pill badge with a rotating cybernetic icon orb, live pulsating status LED, active mode readout, and live 5-color mini palette swatches.
- **Persistence**: Remembers user selection across page refreshes and navigation via `localStorage`.

### 2. ⚡ Zero-Dependency Binary Matrix Interactive Background (`CursorWave`)
- Full-page hardware-accelerated `<canvas>` layer rendering responsive binary `0` and `1` streams.
- Cursor influence swell, click shockwaves, and dynamic DOM element masking (`[data-cursor-wave-mask]`).
- Calibrated with soft, muted opacities so text readability remains crisp in both Day and Night modes.

### 3. 🛡️ GDPR & DPDP Legal & Cookie Retention Suite
- **Privacy Policy ([`privacy-policy.html`](./privacy-policy.html))**: Comprehensive data protection notice compliant with the **EU GDPR** and **Indian Digital Personal Data Protection (DPDP) Act 2023**, with a complete data retention schedule table.
- **Terms & Conditions ([`terms.html`](./terms.html))**: Enterprise service agreements covering Statements of Work (SOW), 100% custom IP ownership transfer, confidentiality, warranties, and Pune jurisdiction.
- **GDPR Cookie Consent Modal ([`cookie-consent.js`](./assets/js/cookie-consent.js) & [`cookie-consent.css`](./assets/css/cookie-consent.css))**:
  - Notice banner stating maximum retention limits (12 months).
  - Granular category toggles: **Strictly Necessary** (always active), **Functional & Themes**, **Performance & Analytics**, and **Marketing**.
  - Footer **"Cookie Settings"** trigger to review or revoke consent anytime.

---

## 📁 Repository Structure

```text
Medhavat/
├── assets/
│   ├── css/
│   │   ├── tokens.css              # Design tokens & 4x data-theme CSS variables
│   │   ├── cursor-wave.css         # Reset, typography, layout grid & canvas styling
│   │   ├── components.css          # Reusable glassmorphic cards, buttons & forms
│   │   ├── theme-hud.css           # Floating 2×2 Theme HUD styles & transitions
│   │   └── cookie-consent.css      # GDPR Cookie retention banner & modal styling
│   ├── js/
│   │   ├── cursor-wave.js          # Interactive binary canvas engine & RGB lerper
│   │   ├── theme-hud.js            # HUD switcher UI, localStorage & event dispatch
│   │   ├── cookie-consent.js       # GDPR Cookie retention controller & modal logic
│   │   └── main.js                 # Global application bootstrap & event wiring
│   ├── fonts/                      # Self-hosted Plus Jakarta Sans & Inter fonts
│   └── images/                     # Vector logo and brand assets
├── index.html                      # Home page
├── services.html                   # Core digital transformation services
├── ai-services.html                # Enterprise AI, RAG & agent solutions
├── portfolio.html                  # Case studies & client success stories
├── insights.html                   # Engineering teardowns & tech perspectives
├── contact.html                    # Consultation & project inquiry form
├── privacy-policy.html             # GDPR / DPDP Privacy policy & retention schedule
├── terms.html                      # Enterprise Terms of Service & conditions
├── vite.config.js                  # Multi-page Vite configuration & rollup inputs
└── package.json                    # Scripts and project dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/wsmaisys/Medhavat.git
cd Medhavat

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

### Production Build
```bash
# Compile and bundle all pages into /dist
npm run build

# Preview production build locally
npm run preview
```

---

## 🎨 Eco-Data Color System Reference

| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Color 1** | `#1B3863` | Deep Corporate Navy (Base & dark accents) |
| **Color 2** | `#155E75` | Ocean Teal (Primary brand accents) |
| **Color 3** | `#0D9488` | Deep Mint (Secondary accents & day primary) |
| **Color 4** | `#14B8A6` | Vibrant Turquoise (Interactive highlights & borders) |
| **Color 5** | `#4ADE80` | Data Green (Metrics, badges & gradients) |

---

## 📄 License & Legal
© 2026 Medhavat. All rights reserved. Registered in Pune, Maharashtra, India.
All client intellectual property, codebases, and custom deliverables are proprietary to their respective owners.
