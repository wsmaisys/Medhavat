const LOGO_SOURCE = "/medhavat-logo-transparent.png";
const FALLBACK_LOGO = "/images/Medhavat_logo.jpeg";

export function renderLogo({
  href = "/",
  alt = "Medhavat home",
  label = alt,
  imageSrc = LOGO_SOURCE,
  vectorSrc = "",
  className = "site-logo",
} = {}) {
  const source = vectorSrc || imageSrc;
  const image = document.createElement("img");
  image.src = source;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      if (image.src.endsWith(FALLBACK_LOGO)) return;
      image.src = FALLBACK_LOGO;
    },
    { once: true },
  );

  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.setAttribute("aria-label", label);

  const mark = document.createElement("span");
  mark.className = "site-logo-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.append(image);

  const wordmark = document.createElement("span");
  wordmark.className = "site-logo-wordmark";
  wordmark.textContent = "Medhavat";
  link.append(mark, wordmark);
  return link;
}

export function renderCanvasLogo({
  href = "/",
  label = "Medhavat home",
  draw,
  className = "site-logo site-logo-canvas",
} = {}) {
  if (typeof draw !== "function") {
    throw new TypeError("renderCanvasLogo requires a draw function");
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  draw(canvas.getContext("2d"), canvas);

  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.setAttribute("aria-label", label);
  link.append(canvas);
  return link;
}
