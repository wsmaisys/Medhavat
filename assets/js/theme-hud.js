/**
 * theme-hud.js — High-Craft Floating Theme Switcher HUD
 * 2×2 Matrix: (Day/Night) × (Coloured/Greyscale)
 * Persists to localStorage, dispatches 'themechange' event
 */

const STORAGE_KEY = 'medhavat-theme';
const DEFAULT_THEME = 'night-grey';

export const THEMES = {
  'night-colour': {
    id: 'night-colour',
    title: 'Eco Dark',
    sub: 'Navy & Teals',
    short: 'N · ECO',
    triggerLabel: 'NIGHT // ECO',
    icon: '☾',
    row: 'night',
    col: 'colour',
    palette: ['#1B3863', '#155E75', '#0D9488', '#14B8A6', '#4ADE80']
  },
  'night-grey': {
    id: 'night-grey',
    title: 'Slate Dark',
    sub: 'Monochrome',
    short: 'N · MONO',
    triggerLabel: 'NIGHT // MONO',
    icon: '☾',
    row: 'night',
    col: 'grey',
    palette: ['#07090e', '#1e293b', '#475569', '#94a3b8', '#cbd5e1']
  },
  'day-colour': {
    id: 'day-colour',
    title: 'Eco Light',
    sub: 'Teal & Emerald',
    short: 'D · ECO',
    triggerLabel: 'DAY // ECO',
    icon: '☼',
    row: 'day',
    col: 'colour',
    palette: ['#f8fafc', '#155E75', '#0D9488', '#14B8A6', '#4ADE80']
  },
  'day-grey': {
    id: 'day-grey',
    title: 'Slate Light',
    sub: 'Greyscale',
    short: 'D · MONO',
    triggerLabel: 'DAY // MONO',
    icon: '☼',
    row: 'day',
    col: 'grey',
    palette: ['#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b']
  }
};

/**
 * CursorWave colour palettes per theme — calibrated with soft opacities
 * so text readability is never affected.
 */
export const THEME_CW_COLORS = {
  'night-grey': [
    '#64748b', '#94a3b8', '#cbd5e1', '#475569', '#334155'
  ],
  'night-colour': [
    'rgba(27, 56, 99, 0.6)',
    'rgba(21, 94, 117, 0.55)',
    'rgba(13, 148, 136, 0.45)',
    'rgba(20, 184, 166, 0.35)',
    'rgba(74, 222, 128, 0.3)'
  ],
  'day-grey': [
    '#cbd5e1', '#e2e8f0', '#d1d5db', '#b0b8c5', '#94a3b8'
  ],
  'day-colour': [
    'rgba(27, 56, 99, 0.35)',
    'rgba(21, 94, 117, 0.3)',
    'rgba(13, 148, 136, 0.25)',
    'rgba(20, 184, 166, 0.2)',
    'rgba(74, 222, 128, 0.18)'
  ]
};

/** Background colours for CursorWave canvas */
export const THEME_CW_BG = {
  'night-grey':   '#07090e',
  'night-colour': '#07090e',
  'day-grey':     '#f8fafc',
  'day-colour':   '#f8fafc'
};

/**
 * Read the saved theme from localStorage (or return default).
 */
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES[saved]) return saved;
  } catch (_) { /* localStorage blocked */ }
  return DEFAULT_THEME;
}

/**
 * Apply a theme to the document and dispatch event.
 */
function applyTheme(themeKey, originX, originY) {
  const html = document.documentElement;

  // Enable cinematic transition class
  html.classList.add('theme-transitioning');

  // Set theme attribute
  html.setAttribute('data-theme', themeKey);

  // Persist
  try { localStorage.setItem(STORAGE_KEY, themeKey); } catch (_) {}

  // Update Trigger Button Text & Status Footer
  updateHUDLabels(themeKey);

  // Dispatch custom event for CursorWave and other listeners
  window.dispatchEvent(new CustomEvent('themechange', {
    detail: {
      theme: themeKey,
      colors: THEME_CW_COLORS[themeKey],
      backgroundColor: THEME_CW_BG[themeKey],
      originX,
      originY
    }
  }));

  // Remove transition class after transitions complete (950ms)
  setTimeout(() => {
    html.classList.remove('theme-transitioning');
  }, 950);
}

/**
 * Update UI text labels in trigger and footer when theme changes.
 */
function updateHUDLabels(themeKey) {
  const config = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const triggerLabel = document.querySelector('.theme-hud__label-text');
  const footerMode = document.querySelector('.theme-hud__footer-mode-val');

  if (triggerLabel) triggerLabel.textContent = config.triggerLabel;
  if (footerMode) footerMode.textContent = `${config.title} (${config.short})`;
}

/**
 * Helper to render mini palette color bar
 */
function renderPaletteBar(colors) {
  return `
    <div class="theme-hud__palette-bar">
      ${colors.map(c => `<span style="background: ${c};"></span>`).join('')}
    </div>
  `;
}

/**
 * Build and mount the HUD DOM.
 */
function buildHUD() {
  // Check if wrapper already exists
  if (document.querySelector('.theme-hud__wrapper')) return;

  const currentTheme = getSavedTheme();
  const currentConfig = THEMES[currentTheme] || THEMES[DEFAULT_THEME];

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-hud__wrapper';

  // ── Trigger Button ──
  const trigger = document.createElement('button');
  trigger.className = 'theme-hud__trigger';
  trigger.setAttribute('aria-label', 'Open theme customizer');
  trigger.setAttribute('title', 'Change theme matrix');
  trigger.innerHTML = `
    <div class="theme-hud__icon-orb">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    </div>
    <div class="theme-hud__label">
      <span class="theme-hud__status-dot"></span>
      <span class="theme-hud__label-text">${currentConfig.triggerLabel}</span>
    </div>
  `;

  // ── Panel ──
  const panel = document.createElement('div');
  panel.className = 'theme-hud__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Theme matrix switcher');

  panel.innerHTML = `
    <div class="theme-hud__header">
      <div class="theme-hud__header-title">
        <span class="theme-hud__header-title-text">Theme Matrix</span>
        <span class="theme-hud__header-badge">2×2 HUD</span>
      </div>
      <button class="theme-hud__close-btn" aria-label="Close HUD">✕</button>
    </div>

    <div class="theme-hud__matrix-container">
      <!-- Column Headers -->
      <div class="theme-hud__matrix-cols">
        <span></span>
        <div class="theme-hud__col-header">✦ Coloured</div>
        <div class="theme-hud__col-header">❖ Greyscale</div>
      </div>

      <!-- Day Row -->
      <div class="theme-hud__matrix-row">
        <div class="theme-hud__row-header">
          <span class="theme-hud__row-icon">☼</span>
          <span class="theme-hud__row-title">Day</span>
        </div>

        <button class="theme-hud__tile ${currentTheme === 'day-colour' ? 'active' : ''}"
                data-theme="day-colour"
                aria-label="Day Coloured theme">
          <span class="theme-hud__tile-check">✓</span>
          ${renderPaletteBar(THEMES['day-colour'].palette)}
          <span class="theme-hud__tile-title">Eco Light</span>
          <span class="theme-hud__tile-sub">Teal & Mint</span>
        </button>

        <button class="theme-hud__tile ${currentTheme === 'day-grey' ? 'active' : ''}"
                data-theme="day-grey"
                aria-label="Day Greyscale theme">
          <span class="theme-hud__tile-check">✓</span>
          ${renderPaletteBar(THEMES['day-grey'].palette)}
          <span class="theme-hud__tile-title">Slate Light</span>
          <span class="theme-hud__tile-sub">Monochrome</span>
        </button>
      </div>

      <!-- Night Row -->
      <div class="theme-hud__matrix-row">
        <div class="theme-hud__row-header">
          <span class="theme-hud__row-icon">☾</span>
          <span class="theme-hud__row-title">Night</span>
        </div>

        <button class="theme-hud__tile ${currentTheme === 'night-colour' ? 'active' : ''}"
                data-theme="night-colour"
                aria-label="Night Coloured theme">
          <span class="theme-hud__tile-check">✓</span>
          ${renderPaletteBar(THEMES['night-colour'].palette)}
          <span class="theme-hud__tile-title">Eco Dark</span>
          <span class="theme-hud__tile-sub">Navy & Teals</span>
        </button>

        <button class="theme-hud__tile ${currentTheme === 'night-grey' ? 'active' : ''}"
                data-theme="night-grey"
                aria-label="Night Greyscale theme">
          <span class="theme-hud__tile-check">✓</span>
          ${renderPaletteBar(THEMES['night-grey'].palette)}
          <span class="theme-hud__tile-title">Slate Dark</span>
          <span class="theme-hud__tile-sub">Monochrome</span>
        </button>
      </div>
    </div>

    <div class="theme-hud__footer">
      <div class="theme-hud__footer-mode">
        Mode: <span class="theme-hud__footer-mode-val">${currentConfig.title} (${currentConfig.short})</span>
      </div>
      <span class="theme-hud__footer-pill">Auto-Saved</span>
    </div>
  `;

  // ── Event Handlers ──
  let isOpen = false;

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    trigger.classList.toggle('open', isOpen);
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    trigger.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  const closeBtn = panel.querySelector('.theme-hud__close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !trigger.contains(e.target)) {
      closePanel();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  // Swatch Tile Clicks
  panel.querySelectorAll('.theme-hud__tile').forEach(tile => {
    tile.addEventListener('click', (e) => {
      const themeKey = tile.dataset.theme;

      // Update active tile indicator
      panel.querySelectorAll('.theme-hud__tile').forEach(t => t.classList.remove('active'));
      tile.classList.add('active');

      // Apply the theme with shockwave originating from click
      applyTheme(themeKey, e.clientX, e.clientY);
    });
  });

  // Mount
  wrapper.appendChild(panel);
  wrapper.appendChild(trigger);
  document.body.appendChild(wrapper);
}

/**
 * Initialize the Theme HUD.
 * Call this from main.js inside DOMContentLoaded.
 */
export function initThemeHud() {
  // Apply saved theme immediately
  const saved = getSavedTheme();
  document.documentElement.setAttribute('data-theme', saved);

  // Build the HUD UI
  buildHUD();

  // Dispatch initial theme event
  window.dispatchEvent(new CustomEvent('themechange', {
    detail: {
      theme: saved,
      colors: THEME_CW_COLORS[saved],
      backgroundColor: THEME_CW_BG[saved]
    }
  }));
}
