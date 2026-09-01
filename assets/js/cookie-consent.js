/**
 * cookie-consent.js — GDPR Compliant Cookie Retention & Preference Manager
 * Features: Banner notice, granular category modal, retention period notices,
 * localStorage persistence, re-open trigger, and event dispatch.
 */

const STORAGE_KEY = 'medhavat-cookie-consent';
const CONSENT_VERSION = 1;

const DEFAULT_PREFERENCES = {
  necessary: true,
  analytics: false,
  functional: true,
  marketing: false
};

/**
 * Get stored consent or null.
 */
export function getCookieConsent() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.version === CONSENT_VERSION) {
        return parsed;
      }
    }
  } catch (_) { /* storage blocked */ }
  return null;
}

/**
 * Save cookie consent preferences.
 */
export function saveCookieConsent(prefs) {
  const payload = {
    ...DEFAULT_PREFERENCES,
    ...prefs,
    necessary: true, // Always required
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}

  // Dispatch event for analytics / script loaders
  window.dispatchEvent(new CustomEvent('cookieconsent', { detail: payload }));
  return payload;
}

/**
 * Build and inject the Cookie Consent Banner & Granular Modal DOM.
 */
export function initCookieConsent() {
  // Prevent duplicate mount
  if (document.getElementById('cookie-consent-container')) return;

  const container = document.createElement('div');
  container.id = 'cookie-consent-container';

  container.innerHTML = `
    <!-- ── Cookie Banner ─────────────────────────────────── -->
    <div class="cookie-consent" id="cookie-banner" role="region" aria-label="Cookie consent banner">
      <div class="cookie-consent__header">
        <div class="cookie-consent__icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10c0 1.5-.5 3-1.5 4a3 3 0 0 1-3 3c-.5 0-1 .5-1 1a2 2 0 0 1-2 2c-.5 0-1 .5-1 1a2 2 0 0 1-2 2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <circle cx="15.5" cy="8.5" r="1.5"/>
            <circle cx="9" cy="14" r="1"/>
          </svg>
        </div>
        <h3 class="cookie-consent__title">Privacy & Cookies</h3>
      </div>

      <p class="cookie-consent__desc">
        We use cookies to ensure fast performance, remember your theme preferences, and analyze anonymized site usage in accordance with the <strong>GDPR</strong> and <strong>Digital Personal Data Protection (DPDP) Act</strong>. Read our <a href="./privacy-policy.html">Privacy Policy</a>.
      </p>

      <div class="cookie-consent__retention-badge">
        <span>⏱</span> Max retention: 12 months · Revocable anytime
      </div>

      <div class="cookie-consent__actions">
        <button class="cookie-consent__btn cookie-consent__btn--accept" id="cookie-accept-all">
          Accept All
        </button>
        <button class="cookie-consent__btn cookie-consent__btn--reject" id="cookie-reject-all">
          Reject Non-Essential
        </button>
        <button class="cookie-consent__btn cookie-consent__btn--settings" id="cookie-open-modal">
          Customize Preferences
        </button>
      </div>
    </div>

    <!-- ── Granular Preferences Modal ────────────────────── -->
    <div class="cookie-modal-overlay" id="cookie-modal-overlay" role="dialog" aria-modal="true" aria-label="Cookie preferences modal">
      <div class="cookie-modal">
        <div class="cookie-modal__header">
          <h2 class="cookie-modal__title">Cookie & Data Retention Preferences</h2>
          <button class="cookie-modal__close" id="cookie-modal-close" aria-label="Close preferences modal">✕</button>
        </div>

        <p class="cookie-modal__intro">
          Choose which cookies you allow us to use. Essential cookies cannot be disabled as they are required for security, session management, and site functionality. You can modify these settings anytime from our footer.
        </p>

        <!-- Category 1: Necessary -->
        <div class="cookie-category">
          <div class="cookie-category__top">
            <span class="cookie-category__name">
              Strictly Necessary Cookies
              <span class="cookie-category__badge">Always Active</span>
            </span>
            <label class="cookie-toggle">
              <input type="checkbox" checked disabled>
              <span class="cookie-toggle__slider"></span>
            </label>
          </div>
          <p class="cookie-category__desc">
            Essential for security, basic routing, navigation, and user session continuity. Cannot be switched off.
          </p>
          <span class="cookie-category__retention">Retention: Session to 12 months</span>
        </div>

        <!-- Category 2: Functional / Themes -->
        <div class="cookie-category">
          <div class="cookie-category__top">
            <span class="cookie-category__name">
              Functional & Theme Preferences
            </span>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-pref-functional" checked>
              <span class="cookie-toggle__slider"></span>
            </label>
          </div>
          <p class="cookie-category__desc">
            Enables the website to remember your chosen HUD theme (Day/Night, Coloured/Greyscale) and localized interactive settings across visits.
          </p>
          <span class="cookie-category__retention">Retention: 12 months (local device storage)</span>
        </div>

        <!-- Category 3: Analytics -->
        <div class="cookie-category">
          <div class="cookie-category__top">
            <span class="cookie-category__name">
              Performance & Anonymized Analytics
            </span>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-pref-analytics">
              <span class="cookie-toggle__slider"></span>
            </label>
          </div>
          <p class="cookie-category__desc">
            Aggregated, IP-anonymized metrics that help us understand page visit counts, Core Web Vitals performance, and popular service journeys.
          </p>
          <span class="cookie-category__retention">Retention: Max 12 months</span>
        </div>

        <!-- Category 4: Marketing -->
        <div class="cookie-category">
          <div class="cookie-category__top">
            <span class="cookie-category__name">
              Marketing & Campaign Tracking
            </span>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-pref-marketing">
              <span class="cookie-toggle__slider"></span>
            </label>
          </div>
          <p class="cookie-category__desc">
            Used to measure conversion effectiveness of external partnership referrals and campaign landing pages.
          </p>
          <span class="cookie-category__retention">Retention: 6 months</span>
        </div>

        <div class="cookie-modal__footer">
          <button class="cookie-consent__btn cookie-consent__btn--reject" id="cookie-modal-reject">
            Reject All Non-Essential
          </button>
          <button class="cookie-consent__btn cookie-consent__btn--accept" id="cookie-modal-save">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // ── Element Bindings ──
  const banner = document.getElementById('cookie-banner');
  const modalOverlay = document.getElementById('cookie-modal-overlay');
  const btnAcceptAll = document.getElementById('cookie-accept-all');
  const btnRejectAll = document.getElementById('cookie-reject-all');
  const btnOpenModal = document.getElementById('cookie-open-modal');
  const btnCloseModal = document.getElementById('cookie-modal-close');
  const btnModalSave = document.getElementById('cookie-modal-save');
  const btnModalReject = document.getElementById('cookie-modal-reject');

  const checkFunctional = document.getElementById('cookie-pref-functional');
  const checkAnalytics = document.getElementById('cookie-pref-analytics');
  const checkMarketing = document.getElementById('cookie-pref-marketing');

  function showBanner() {
    setTimeout(() => {
      if (banner) banner.classList.add('visible');
    }, 800);
  }

  function hideBanner() {
    if (banner) banner.classList.remove('visible');
  }

  function openModal() {
    const existing = getCookieConsent();
    if (existing) {
      if (checkFunctional) checkFunctional.checked = !!existing.functional;
      if (checkAnalytics) checkAnalytics.checked = !!existing.analytics;
      if (checkMarketing) checkMarketing.checked = !!existing.marketing;
    }
    if (modalOverlay) modalOverlay.classList.add('open');
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('open');
  }

  // ── Event Handlers ──
  if (btnAcceptAll) {
    btnAcceptAll.addEventListener('click', () => {
      saveCookieConsent({
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true
      });
      hideBanner();
    });
  }

  if (btnRejectAll) {
    btnRejectAll.addEventListener('click', () => {
      saveCookieConsent({
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false
      });
      hideBanner();
    });
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      openModal();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      closeModal();
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (btnModalSave) {
    btnModalSave.addEventListener('click', () => {
      saveCookieConsent({
        necessary: true,
        functional: checkFunctional ? checkFunctional.checked : true,
        analytics: checkAnalytics ? checkAnalytics.checked : false,
        marketing: checkMarketing ? checkMarketing.checked : false
      });
      closeModal();
      hideBanner();
    });
  }

  if (btnModalReject) {
    btnModalReject.addEventListener('click', () => {
      saveCookieConsent({
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false
      });
      closeModal();
      hideBanner();
    });
  }

  // Bind any external "[data-open-cookies]" triggers (e.g. in footer)
  document.querySelectorAll('[data-open-cookies]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  // Check initial state
  const existingConsent = getCookieConsent();
  if (!existingConsent) {
    showBanner();
  }
}
