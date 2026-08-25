const LOGO_SOURCE = "/images/medhavat-logo-transparent.png";
const LOGO_FALLBACKS = [
  "/public/images/medhavat-logo-transparent.png",
  "/images/Medhavat_logo.jpeg",
  "/public/images/Medhavat_logo.jpeg",
];

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
  let fallbackIndex = -1;
  image.addEventListener("error", () => {
    fallbackIndex += 1;
    const fallback = LOGO_FALLBACKS[fallbackIndex];
    if (fallback) image.src = fallback;
  });

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
