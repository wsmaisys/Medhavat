const page = document.body;

const progress = document.createElement("div");
progress.className = "scroll-progress";
progress.setAttribute("aria-hidden", "true");
progress.innerHTML = "<span></span>";
page.append(progress);

queueMicrotask(() => {
  const sections = [
    ...document.querySelectorAll(".content-item, .service-detail-card"),
    ...document.querySelectorAll(".home-section"),
  ];
  const reveal = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) =>
        entry.target.classList.toggle("is-visible", entry.isIntersecting),
      ),
    { threshold: 0.18 },
  );
  sections.forEach((section) => reveal.observe(section));
});

let scrollEndTimer = 0;
window.addEventListener(
  "scroll",
  () => {
    page.classList.add("is-scrolling");
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      page.classList.remove("is-scrolling");
    }, 140);
  },
  { passive: true },
);
