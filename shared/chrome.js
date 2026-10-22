// Builds the SQ-style AI Mode chrome (sub-header, hero, prompt cards, Smart Options panel).
// The page decides what a click does — every option funnels into `onSend(text, source)`.
import { HERO, CARDS, SMART_OPTIONS, PROMPTS, TERMS_URL } from "./content.js";

export const ICONS = {
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z"/><path d="M17.5 13l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="currentColor"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  chevRight: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  feedback: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H9l-4.3 3.4A.5.5 0 014 20V5a1 1 0 011-1z"/><path fill="#fff" d="M12 7.2l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 4.5l17 7.5-17 7.5 2.8-7.5z"/><path d="M6.3 12h7"/></svg>',
  plane: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 15.5v-1.8l-8.2-5V3.6a1.3 1.3 0 00-2.6 0v5.1l-8.2 5v1.8l8.2-2.5v5.2l-2.1 1.5V21l3.4-1 3.4 1v-1.3L13.3 18v-5.2z" transform="rotate(60 12 12)"/></svg>',
  meal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3v8a2 2 0 002 2v8M5 3v5M9 3v5M17 3c-1.7 1-2.5 3-2.5 6v4H17v8"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** AI Mode bar: brand left; Flight Finder, Login and feedback right. */
export function buildBar(el, { onSmartOptions, onLogin, onFeedback }) {
  el.className = "am-bar";
  el.innerHTML = `
    <div class="am-brand">${ICONS.sparkle}<span>AskMavis</span><span class="am-beta">BETA</span></div>
    <div class="am-actions">
      <button class="am-pill" data-a="ff" aria-label="Flight Finder options"><span class="ff-label">Flight Finder</span>${ICONS.chevDown}</button>
      <button class="am-pill login" data-a="login" aria-label="Log in with Enrich">Login</button>
      <button class="am-pill icon" data-a="fb" aria-label="Share feedback">${ICONS.feedback}</button>
    </div>`;
  el.querySelector('[data-a="ff"]').onclick = onSmartOptions;
  el.querySelector('[data-a="login"]').onclick = onLogin;
  el.querySelector('[data-a="fb"]').onclick = onFeedback;
  const btn = el.querySelector('[data-a="login"]');
  return {
    /** "idle" | "busy" | "signed" */
    setLogin(state, label) {
      btn.classList.toggle("busy", state === "busy");
      btn.classList.toggle("signed", state === "signed");
      btn.textContent = label || (state === "signed" ? "Signed in" : state === "busy" ? "Signing in…" : "Login");
    },
  };
}

/** Hero greeting + the three prompt cards. `assetBase` is the path to /assets/. */
export function buildHero(el, { onSend, assetBase, compact = false }) {
  el.className = "am-hero" + (compact ? " compact" : "");
  el.innerHTML = `
    <h1>${ICONS.sparkle}<span>${esc(HERO.title)}</span></h1>
    <p class="lead">${esc(HERO.lead)}</p>
    <div class="am-cards">
      ${CARDS.map((c, i) => `
        <button class="am-card" data-i="${i}">
          <div class="txt"><b>${esc(c.title)}</b><span>${esc(c.sub)}</span></div>
          ${c.img ? `<img src="${assetBase}${c.img}" alt="">` : ""}
        </button>`).join("")}
    </div>`;
  el.querySelectorAll(".am-card").forEach((b) => (b.onclick = () => onSend(CARDS[+b.dataset.i].send, "card")));
}

/** "View Smart Options" slide-over. Returns { open, close }. */
export function buildPanel(root, { onSend }) {
  const scrim = document.createElement("div");
  scrim.className = "am-scrim";
  const panel = document.createElement("aside");
  panel.className = "am-panel";
  panel.setAttribute("aria-label", "View Smart Options");
  panel.innerHTML = `
    <button class="am-close" aria-label="Close">${ICONS.close}</button>
    <h2>View Smart Options</h2>
    ${SMART_OPTIONS.map((o, i) => `
      <button class="am-opt" data-o="${i}">
        <span class="ic">${i === 0 ? ICONS.plane : ICONS.meal}</span>
        <span class="t"><b>${esc(o.title)}</b><span>${esc(o.sub)}</span></span>${ICONS.chevRight}
      </button>`).join("")}
    <div class="am-kicker">TRY THESE PROMPTS</div>
    <div class="am-chips">${PROMPTS.map((p, i) => `<button class="am-chip" data-p="${i}">${esc(p.label)}</button>`).join("")}</div>`;
  root.append(scrim, panel);
  const host = document.documentElement;
  const close = () => host.classList.remove("am-open");
  const open = () => host.classList.add("am-open");
  scrim.onclick = close;
  panel.querySelector(".am-close").onclick = close;
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  panel.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => { close(); onSend(SMART_OPTIONS[+b.dataset.o].send, "smart-option"); }));
  panel.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { close(); onSend(PROMPTS[+b.dataset.p].send, "prompt"); }));
  return { open, close };
}

export function disclaimerHtml() {
  return `AskMavis can make mistakes. Verify important information. <a href="${TERMS_URL}" target="_blank" rel="noopener">T&amp;Cs</a>`;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  let t = document.querySelector(".am-toast");
  if (!t) { t = document.createElement("div"); t.className = "am-toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

export const MH_HEADER = (assetBase) => `
  <div class="mh-header-in">
    <a class="mh-logo" href="https://www.malaysiaairlines.com/my/en/home.html" target="_blank" rel="noopener">
      <img class="brand" src="${assetBase}mh-logo.png" alt="Malaysia Airlines">
      <img class="ow" src="${assetBase}oneworld.png" alt="oneworld member">
    </a>
    <nav class="mh-nav" aria-label="Main">
      <a href="#">Explore</a><a href="#">Plan Trip</a><a href="#">Experience</a><a href="#">Corporate Travel</a><a href="#">Enrich Loyalty</a>
    </nav>
    <div class="mh-util">
      <span class="hide-sm"><img src="${assetBase}flag-my-en.png" alt="">EN</span>
      <span>AskMavis</span>
    </div>
  </div>`;
