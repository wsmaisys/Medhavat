/**
 * main.js — Global script for Medhavat Website
 * Full-Page Binary Greyscale CursorWave & Interactive Features
 */
import { CursorWave } from './cursor-wave.js';
import { initThemeHud, THEME_CW_COLORS, THEME_CW_BG } from './theme-hud.js';
import { initCookieConsent } from './cookie-consent.js';

/** @type {CursorWave|null} */
let cursorWaveInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeHud();          // Apply saved theme + mount HUD
  initCookieConsent();     // GDPR Cookie & Retention Modal
  initGlobalCursorWave();  // CursorWave uses current theme colors
  initNavbar();
  initMobileMenu();
  initScrollReveal();
  initCounters();
  initContactForm();
  initFilterTabs();

  // Listen for dynamic theme changes to update CursorWave
  window.addEventListener('themechange', (e) => {
    if (cursorWaveInstance && e.detail) {
      cursorWaveInstance.updateColors(
        e.detail.colors,
        e.detail.backgroundColor,
        e.detail.originX,
        e.detail.originY
      );
    }
  });
});

/* ── Full-Page Global Binary CursorWave ────────────────────── */
function initGlobalCursorWave() {
  let container = document.getElementById('cw-global-canvas-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'cw-global-canvas-container';
    document.body.prepend(container);
  }

  // Get current theme colors
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'night-grey';
  const cwColors = THEME_CW_COLORS[currentTheme] || THEME_CW_COLORS['night-grey'];
  const cwBg = THEME_CW_BG[currentTheme] || THEME_CW_BG['night-grey'];

  try {
    cursorWaveInstance = new CursorWave(container, {
      shapes: ['0', '1'],
      colors: cwColors,
      backgroundColor: cwBg,
      cellSize: window.innerWidth < 768 ? 36 : 42,
      idleScale: 0.16,
      influenceRadiusVmin: window.innerWidth < 768 ? 44 : 36
    });
  } catch (e) {
    console.warn('CursorWave init error:', e);
  }
}

/* ── Navbar Scrolled State ────────────────────────────────── */
function initNavbar() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Mobile Menu Drawer ───────────────────────────────────── */
function initMobileMenu() {
  const hamburger = document.querySelector('.nav__hamburger');
  const drawer = document.querySelector('.nav__drawer');
  if (!hamburger || !drawer) return;

  const toggle = () => {
    const isOpen = drawer.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  hamburger.addEventListener('click', toggle);

  drawer.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ── Scroll Reveal ────────────────────────────────────────── */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: '80px 0px' }
  );

  reveals.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      el.classList.add('reveal--pending');
      observer.observe(el);
    } else {
      el.classList.add('visible');
    }
  });
}

/* ── Animated Stats Counter ───────────────────────────────── */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.counter, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1800;
          const startTime = performance.now();

          const update = now => {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
            const current = Math.floor(ease * target);
            el.textContent = current + suffix;

            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              el.textContent = target + suffix;
            }
          };

          requestAnimationFrame(update);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(c => observer.observe(c));
}

/* ── Interactive Contact Form ─────────────────────────────── */
function initContactForm() {
  const form = document.querySelector('#contact-form');
  const successBox = document.querySelector('#contact-success');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    setTimeout(() => {
      form.style.display = 'none';
      if (successBox) {
        successBox.classList.add('visible');
      }
    }, 600);
  });
}

/* ── Filter Tabs (Insights Page) ──────────────────────────── */
function initFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  const cards = document.querySelectorAll('[data-category]');
  if (!tabs.length || !cards.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = '';
          card.classList.add('visible');
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}
