/**
 * CursorWave Engine - Zero Dependency Binary Matrix Interactive Canvas
 * Features: Full-page fixed viewport, binary 0 and 1 greyscale theme,
 * pointer swell, click shockwaves, and content masking.
 */
export class CursorWave {
  constructor(container, options = {}) {
    if (!container) {
      throw new Error('CursorWave requires a valid container element.');
    }
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) return;
    
    // Default Binary Greyscale Options
    this.options = {
      cellSize: 46,                   // Pixel spacing between digits
      influenceRadiusVmin: 34,        // Cursor influence radius as % of min(width, height)
      attackTime: 0.25,               // Swell-up ease time in seconds
      releaseTime: 0.6,               // Relax-down ease time in seconds
      idleScale: 0.14,                // Ambient resting scale for binary digits
      minPeakScale: 1.2,              // Minimum peak scale assigned on hover
      maxPeakScale: 2.2,              // Maximum peak scale assigned on hover
      burstSpeed: 1100,               // Click shockwave expansion speed (px/sec)
      burstThickness: 160,            // Click shockwave ring width in pixels
      backgroundColor: '#07090e',     // Canvas background fill
      opacity: 1.0,                   // Master canvas opacity
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      shapes: ['0', '1'],             // Binary theme exclusively 0 and 1
      colors: [                       // Calibrated soft greyscale palette
        '#64748b',
        '#94a3b8',
        '#cbd5e1',
        '#475569',
        '#334155'
      ],
      ...options
    };

    // Engine State
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cursor-wave-canvas';
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.width = 0;
    this.height = 0;
    this.cells = [];
    this.ripples = [];
    this.maskRects = [];
    this.pointer = null; // { x, y }
    this.pointerEnergy = 0;
    this.lastTime = performance.now();
    this.rafId = null;
    this.resizeObserver = null;
    this.maskFrameCounter = 0;

    // Event Bindings
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.tick = this.tick.bind(this);

    this.init();
  }

  init() {
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });

    this.handleResize();
    this.updateMasks();
    this.rafId = requestAnimationFrame(this.tick);
  }

  handleResize() {
    this.width = window.innerWidth || document.documentElement.clientWidth || 1000;
    this.height = window.innerHeight || document.documentElement.clientHeight || 800;

    const dpr = this.options.dpr;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.rebuildGrid();
  }

  rebuildGrid() {
    const { cellSize, shapes, colors, idleScale } = this.options;
    this.cells = [];

    if (this.width <= 0 || this.height <= 0) return;

    const cols = Math.ceil(this.width / cellSize) + 2;
    const rows = Math.ceil(this.height / cellSize) + 2;

    const offsetX = (this.width - (cols - 1) * cellSize) / 2;
    const offsetY = (this.height - (rows - 1) * cellSize) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const angle = (Math.random() - 0.5) * 0.2; // subtle tilt

        this.cells.push({
          x,
          y,
          angle,
          scale: idleScale,
          targetScale: idleScale,
          peak: idleScale,
          shape,
          color,
          hovered: false
        });
      }
    }
  }

  updateMasks() {
    const maskElements = document.querySelectorAll('[data-cursor-wave-mask]');
    const rects = [];

    maskElements.forEach(el => {
      const r = el.getBoundingClientRect();
      // Only mask elements currently visible within the viewport
      if (r.bottom >= 0 && r.top <= this.height && r.right >= 0 && r.left <= this.width) {
        rects.push({
          left: r.left - 12,
          top: r.top - 8,
          right: r.right + 12,
          bottom: r.bottom + 8
        });
      }
    });

    this.maskRects = rects;
  }

  handlePointerMove(e) {
    this.pointer = {
      x: e.clientX,
      y: e.clientY
    };
    this.pointerEnergy = 1.0;
  }

  handlePointerLeave() {
    this.pointer = null;
  }

  handlePointerDown(e) {
    this.burst(e.clientX, e.clientY);
  }

  burst(x, y) {
    let px = x;
    let py = y;

    if (px === undefined || py === undefined) {
      if (this.pointer) {
        px = this.pointer.x;
        py = this.pointer.y;
      } else {
        px = this.width / 2;
        py = this.height / 2;
      }
    }

    this.ripples.push({
      x: px,
      y: py,
      start: performance.now()
    });
  }

  smoothstep(t) {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
  }

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  tick(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    const ctx = this.ctx;
    const opts = this.options;
    const { width, height } = this;

    if (width <= 0 || height <= 0) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    // Clear and fill dark background
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = opts.opacity;
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Periodically sync mask positions during scrolling/layout shifts
    this.maskFrameCounter++;
    if (this.maskFrameCounter % 15 === 0) {
      this.updateMasks();
    }

    this.pointerEnergy *= 0.95;

    const vmin = Math.min(width, height);
    const influenceRadius = (opts.influenceRadiusVmin / 100) * vmin;

    // Filter active shockwaves
    const maxDiagonal = Math.sqrt(width * width + height * height);
    this.ripples = this.ripples.filter(ripple => {
      const elapsed = (currentTime - ripple.start) / 1000;
      const currentRadius = elapsed * opts.burstSpeed;
      return currentRadius < maxDiagonal + opts.burstThickness;
    });

    const attackFactor = 1 - Math.exp(-dt / Math.max(0.01, opts.attackTime * 0.25));
    const releaseFactor = 1 - Math.exp(-dt / Math.max(0.01, opts.releaseTime * 0.25));
    const halfCell = opts.cellSize * 0.45;

    // Process Grid Cells
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];

      // 1. Check DOM Element Masking
      let isMasked = false;
      for (let m = 0; m < this.maskRects.length; m++) {
        const mask = this.maskRects[m];
        if (
          cell.x >= mask.left - halfCell &&
          cell.x <= mask.right + halfCell &&
          cell.y >= mask.top - halfCell &&
          cell.y <= mask.bottom + halfCell
        ) {
          isMasked = true;
          break;
        }
      }

      if (isMasked) {
        cell.scale += (0 - cell.scale) * releaseFactor;
        if (cell.scale < 0.005) cell.scale = 0;
        continue;
      }

      // 2. Cursor Swell Calculation
      let cursorIntensity = 0;
      if (this.pointer && this.pointerEnergy > 0.001 && influenceRadius > 0) {
        const dx = cell.x - this.pointer.x;
        const dy = cell.y - this.pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const rawFactor = 1 - dist / influenceRadius;
        cursorIntensity = this.smoothstep(rawFactor) * this.pointerEnergy;

        if (cursorIntensity > 0.05 && !cell.hovered) {
          cell.hovered = true;
          cell.peak = this.randomRange(opts.minPeakScale, opts.maxPeakScale);
        } else if (cursorIntensity <= 0.05) {
          cell.hovered = false;
        }
      } else {
        cell.hovered = false;
      }

      // 3. Shockwave Burst Ripple Calculation
      let rippleIntensity = 0;
      for (let r = 0; r < this.ripples.length; r++) {
        const ripple = this.ripples[r];
        const elapsed = (currentTime - ripple.start) / 1000;
        const ringRadius = elapsed * opts.burstSpeed;

        const dx = cell.x - ripple.x;
        const dy = cell.y - ripple.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const proximity = 1 - Math.abs(dist - ringRadius) / opts.burstThickness;
        if (proximity > 0) {
          const wavePulse = Math.sin(Math.PI * proximity);
          if (wavePulse > rippleIntensity) {
            rippleIntensity = wavePulse;
          }
        }
      }

      // 4. Combine Hover & Ripple Target Scale
      const scaleDelta = cell.peak - opts.idleScale;
      const hoverTarget = opts.idleScale + cursorIntensity * scaleDelta;
      const rippleTarget = opts.idleScale + rippleIntensity * scaleDelta;
      const targetScale = Math.max(hoverTarget, rippleTarget);

      // 5. Ease toward target scale
      const currentEasing = targetScale > cell.scale ? attackFactor : releaseFactor;
      cell.scale += (targetScale - cell.scale) * currentEasing;

      if (cell.scale < opts.idleScale * 0.1) continue;

      // 6. Canvas Draw Operation (0 and 1 in greyscale with soft ambient alpha)
      const alphaBoost = Math.min(0.65, 0.16 + (cell.scale - opts.idleScale) * 0.4);
      ctx.globalAlpha = alphaBoost;
      ctx.fillStyle = cell.color;

      ctx.save();
      ctx.translate(cell.x, cell.y);
      ctx.rotate(cell.angle);
      ctx.scale(cell.scale, cell.scale);

      const fontSize = Math.max(14, opts.cellSize * 0.72);
      ctx.font = `800 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.shape, 0, 0);

      ctx.restore();
    }

    ctx.globalAlpha = 1.0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('resize', this.handleResize);

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
