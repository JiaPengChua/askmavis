// AskMavis custom app — runs inside Ada's Messaging frame (appUrl). Ada core owns the session,
// transport and the AI agent; this document renders the SQ-style UI from the bridge display state.
import { loadMessagingBridge } from "./bridge-loader.js";
import { FEEDBACK_TEXT, LOGIN_TEXT } from "../../shared/content.js";
import { buildBar, buildHero, buildPanel, disclaimerHtml, toast, ICONS } from "../../shared/chrome.js";
import { findSignInAsk, looksSignedIn } from "../../shared/login.js";

const ASSETS = "../../assets/";
const $ = (id) => document.getElementById(id);
const trace = [];
const log = (...a) => { trace.push([Date.now(), ...a]); console.debug("[askmavis-app]", ...a); };

/* ---------- chrome ---------- */
$("am-disclaimer").innerHTML = disclaimerHtml();
$("sendbtn").innerHTML = ICONS.send;
const panel = buildPanel(document.body, { onSend: send });
const bar = buildBar($("am-bar"), { onSmartOptions: () => panel.open(), onLogin: login, onFeedback: () => send(FEEDBACK_TEXT, "feedback") });
buildHero($("am-hero"), { onSend: send, assetBase: ASSETS });

/* ---------- bridge ---------- */
let bridge, client;
try {
  bridge = await loadMessagingBridge();
  client = bridge.createBridgeClient();
  client.sendEvent("app.initialize"); // must land within 15s of the frame mounting
  log("bridge ready");
} catch (e) {
  $("boot").textContent = "This page only runs inside Ada's Messaging frame. Open /askmavis/custom-app/ instead.";
  $("boot").classList.add("err");
  throw e;
}
const S = () => client.getState() || {};

/* ---------- view state ---------- */
// The Greeting runs before the customer does anything. Like SQ, the hero stands in for it, so the
// thread starts at the customer's first action: `startAt` names that row (by id or clientKey).
const KEY = "askmavis.startAt";
let startAt = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } })();
const setStartAt = (v) => { startAt = v; try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
let loginPending = false, signedIn = false;

function rows() {
  const st = S();
  return bridge.filterDisplayable(st["chat.messages"] || [], !!st["chat.isConversationActive"]);
}
const norm = (list) => list.map((m) => ({ id: m.id, sender: m.sender, type: m.type, body: m.body || "", replies: m.quickReplies || [] }));

/* ---------- actions ---------- */
let busy = false;
async function send(text, source = "composer") {
  text = (text || "").trim();
  if (!text || busy) return;
  busy = true;
  try {
    // Sending straight into the Greeting's pending "Would you like to sign in?" ask works: Mavis
    // treats the question as off-script and answers it (verified live on the Ada-window page).
    const handle = client.operations.sendMessage(text.slice(0, 500));
    if (!startAt) setStartAt({ key: handle.tempMessageUuid });
    log("sent", source, text);
  } catch (e) {
    log("send failed", e);
    toast("Mavis is busy — try again in a moment");
  } finally {
    busy = false;
    render();
  }
}

function login() {
  if (signedIn) return toast("You're signed in to Enrich");
  const list = rows();
  // A sign-in card is already on screen: the header button opens it directly (user gesture → popup allowed).
  const card = [...list].reverse().find((m) => m.type === "sign_in" && !m.authLinkExpired);
  if (card && loginPending) return openSignIn(card);
  const n = norm(list);
  const ask = findSignInAsk(n);
  loginPending = true;
  bar.setLogin("busy");
  if (ask) {
    const i = list.findIndex((m) => m.id === ask.message.id);
    const from = i > 0 && list[i - 1].sender === "bot" && /sign in/i.test(list[i - 1].body || "") ? list[i - 1] : list[i];
    if (!startAt) setStartAt({ id: from.id });
    log("login → Greeting sign-in ask: Yes");
    client.operations.selectQuickReply(ask.message.replies[ask.yes], ask.message.id);
    render();
  } else {
    log("login → no pending ask, asking Mavis");
    busy = false;
    send(LOGIN_TEXT, "login");
  }
}

function openSignIn(m) {
  const w = window.open(m.authLink, "enrich_signin", "popup=yes,width=480,height=720");
  if (!w) toast("Allow pop-ups to sign in with Enrich");
}

let lastInbound = 0;
const quiet = (ms = 2200, cap = 12000) => new Promise((res) => {
  const t0 = Date.now();
  (function tick() { (Date.now() - lastInbound >= ms || Date.now() - t0 >= cap) ? res() : setTimeout(tick, 200); })();
});

/* ---------- composer ---------- */
const q = $("q");
$("composer").onsubmit = (e) => { e.preventDefault(); const t = q.value; q.value = ""; syncSend(); send(t); };
q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("composer").requestSubmit(); } });
q.addEventListener("input", syncSend);
function syncSend() { $("sendbtn").classList.toggle("ready", !!q.value.trim()); }

/* ---------- rendering ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
// Bot bodies are markdown. Escape first, then re-introduce a small whitelist — never raw HTML.
function md(src) {
  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  const out = [];
  let list = null;
  for (const line of String(src || "").split("\n")) {
    const ul = line.match(/^\s*[-•*]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), h = line.match(/^#{1,4}\s+(.*)/);
    const kind = ul ? "ul" : ol ? "ol" : null;
    if (kind) { if (!list || list.kind !== kind) { list && out.push(`</${list.kind}>`); list = { kind }; out.push(`<${kind}>`); } out.push(`<li>${inline((ul || ol)[1])}</li>`); continue; }
    if (list) { out.push(`</${list.kind}>`); list = null; }
    if (h) out.push(`<h4>${inline(h[1])}</h4>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list.kind}>`);
  return out.join("");
}

const AV = `<div class="av"><img src="${ASSETS}mh-mark.png" alt="" style="width:34px;height:34px;border-radius:50%"></div>`;
const AV_GHOST = `<div class="av ghost"></div>`;

function interactiveLive(m, st) {
  const answered = st["chat.answeredInteractiveIds"] || [];
  return !answered.includes(m.id) && !bridge.isHistoricalRow(m.conversationId, st);
}

function botInner(m, st) {
  const live = interactiveLive(m, st);
  switch (m.type) {
    case "text": {
      const att = (m.attachments || []).map((a) => safeUrl(a.url) ? `<a href="${a.url}" target="_blank" rel="noopener">${esc(a.filename || "Attachment")}</a>` : "").join(" ");
      return md(m.body) + att;
    }
    case "quick_replies": {
      const rs = m.quickReplies || [];
      const asCards = rs.length && rs.every((r) => r.card && (r.card.image || r.card.description));
      const btns = rs.map((r, i) => asCards
        ? `<button data-qr="${i}" ${live ? "" : "disabled"}>${r.card.image ? `<img src="${esc(r.card.image.url)}" alt="${esc(r.card.image.alt || "")}">` : ""}<b>${esc(r.card.title || r.label)}</b>${r.card.description ? `<span>${esc(r.card.description)}</span>` : ""}</button>`
        : `<button data-qr="${i}" ${live ? "" : "disabled"}>${esc(r.label || r.value)}</button>`).join("");
      const layout = m.buttonLayout === "carousel" ? "" : " stacked";
      return (m.body ? md(m.body) : "") + (asCards ? `<div class="cards">${btns}</div>` : `<div class="qr${layout}">${btns}</div>`);
    }
    case "link": {
      const u = safeUrl(m.url);
      return (m.body ? md(m.body) : "") + (u ? `<button class="linkcard" data-link><span style="flex:1"><b>${esc(m.title || m.linkText || u)}</b>${m.linkDescription ? `<span>${esc(m.linkDescription)}</span>` : ""}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg></button>` : "");
    }
    case "picture": return safeUrl(m.picUrl) ? `<img class="pic" src="${m.picUrl}" alt="${esc(m.altText || "")}">` : "";
    case "video": return safeUrl(m.vidUrl) ? `<a href="${m.vidUrl}" target="_blank" rel="noopener">Watch video</a>` : "";
    case "downloadable": return safeUrl(m.url) ? `<a href="${m.url}" target="_blank" rel="noopener">${esc(m.name || "Download")}</a>${m.caption ? md(m.caption) : ""}` : "";
    case "widget": return safeUrl(m.widgetUrl) ? `<button class="linkcard" data-widget><span style="flex:1"><b>${esc(m.linkText || m.widgetName)}</b>${m.linkSubtext ? `<span>${esc(m.linkSubtext)}</span>` : ""}</span></button>` : "";
    case "sign_in": {
      const expired = m.authLinkExpired || !safeUrl(m.authLink);
      return `${m.messageLead ? md(m.messageLead) : m.body ? md(m.body) : ""}
        <div class="signin">
          <div class="top"><img src="${ASSETS}mh-mark.png" alt=""><div><b>Enrich sign-in</b><span>Malaysia Airlines Enrich · secure login</span></div></div>
          <div class="mid">Sign in so Mavis can see your bookings, Enrich Points and tier.
            <button class="btn" data-signin ${expired ? "disabled" : ""}>${esc(expired ? "Sign-in link expired" : m.authButtonLabel || "Sign in with Enrich")}</button>
            <small>Opens the Enrich login in a new window. Mavis continues here once you're signed in.</small></div>
        </div>`;
    }
    case "options_message": return (m.body ? md(m.body) : "") + `<div class="qr stacked">${(m.options || []).map((o, i) => `<button data-opt="${i}" ${live ? "" : "disabled"}>${esc(o.label)}${o.description ? ` — ${esc(o.description)}` : ""}</button>`).join("")}</div>`;
    case "surfaceable_list_selection": {
      const type = m.multiple ? "checkbox" : "radio";
      return md(m.prompt || m.body) + `<div class="list">${(m.selectables || []).map((s) => `<label><input type="${type}" name="ls-${esc(m.id)}" value="${esc(s.id)}" ${live ? "" : "disabled"}> ${esc(s.text)}</label>`).join("")}
        <div class="acts"><button class="btn" data-ls-submit ${live ? "" : "disabled"}>Submit</button><button class="btn ghost" data-ls-cancel ${live ? "" : "disabled"}>None of these</button></div></div>`;
    }
    case "queue_bot_block": return `<p>${esc(m.waitMessage || "Connecting you to a human agent…")}${m.queuePosition ? ` (position ${m.queuePosition})` : ""}</p>`;
    case "csat": return `<p>${m.submitted ? "Thanks for your feedback." : "How was your chat with Mavis today?"}</p>`;
    default: return m.body ? md(m.body) : "";
  }
}

let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; paint(); });
}

let lastSig = "";
function paint() {
  const st = S();
  if (st["app.loading"] === false || (st["chat.messages"] || []).length) $("boot").classList.add("gone");
  const all = rows();
  const n = norm(all);
  signedIn = looksSignedIn(n);
  const lastUser = [...n].reverse().find((m) => m.sender === "user");
  if (loginPending && !signedIn && lastUser && /^no\b/i.test(lastUser.body)) loginPending = false;
  bar.setLogin(signedIn ? "signed" : loginPending ? "busy" : "idle");

  // Where the visible thread starts.
  let from = -1;
  if (startAt) from = all.findIndex((m) => (startAt.key && m.clientKey === startAt.key) || (startAt.id && m.id === startAt.id));
  if (from < 0 && !startAt) from = all.findIndex((m) => m.sender === "user") >= 0 ? 0 : -1; // restored chat with no marker
  const pendingOwnSend = startAt && from < 0; // our first message is in flight
  const heroMode = from < 0 && !pendingOwnSend;
  $("am-hero").hidden = !heroMode;
  $("thread").hidden = heroMode;
  if (heroMode) return;

  const visible = from >= 0 ? all.slice(from) : [];
  const typing = st["chat.isGenerating"] || st["ui.typingIndicator.visible"] || pendingOwnSend;
  const sig = JSON.stringify([visible.map((m) => [m.id, m.clientKey, (m.body || "").length, m.type]), st["chat.answeredInteractiveIds"], typing]);
  if (sig === lastSig) return;
  lastSig = sig;

  const thread = $("thread");
  const nearBottom = $("scroll").scrollHeight - $("scroll").scrollTop - $("scroll").clientHeight < 140;
  thread.innerHTML = "";
  let prevSender = null;
  for (const m of visible) {
    if (m.type === "presence") { thread.insertAdjacentHTML("beforeend", `<div class="sys">${esc(m.body || m.event)}</div>`); prevSender = null; continue; }
    const row = document.createElement("div");
    if (m.sender === "user") {
      row.className = "row user";
      row.innerHTML = `<div class="bub">${esc(m.body)}</div>`;
    } else {
      row.className = "row bot";
      const inner = botInner(m, st);
      if (!inner) continue;
      row.innerHTML = (prevSender === "bot" ? AV_GHOST : AV) + `<div class="bub">${inner}</div>`;
      wire(row, m);
    }
    prevSender = m.sender;
    thread.append(row);
  }
  if (typing) thread.insertAdjacentHTML("beforeend", `<div class="row bot">${prevSender === "bot" ? AV_GHOST : AV}<div class="typing" aria-label="Mavis is typing"><i></i><i></i><i></i></div></div>`);
  if (nearBottom || typing) requestAnimationFrame(() => { $("scroll").scrollTop = $("scroll").scrollHeight; });
}

function wire(row, m) {
  row.querySelectorAll("[data-qr]").forEach((b) => (b.onclick = () => {
    const r = m.quickReplies[+b.dataset.qr];
    if (/^yes\b/i.test(r.label || "") && findSignInAsk(norm(rows()))?.message.id === m.id) { loginPending = true; }
    b.classList.add("picked");
    client.operations.selectQuickReply(r, m.id);
  }));
  row.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => client.operations.selectOption(m.options[+b.dataset.opt], m.id)));
  row.querySelector("[data-link]")?.addEventListener("click", () => { client.operations.reportLinkClick(m.id); window.open(m.url, "_blank", "noopener"); });
  row.querySelector("[data-widget]")?.addEventListener("click", () => window.open(m.widgetUrl, "_blank", "noopener"));
  row.querySelector("[data-signin]")?.addEventListener("click", () => openSignIn(m));
  row.querySelector("[data-ls-submit]")?.addEventListener("click", () => {
    const ids = [...row.querySelectorAll("input:checked")].map((i) => i.value);
    if (ids.length) client.operations.submitListSelection(ids);
  });
  row.querySelector("[data-ls-cancel]")?.addEventListener("click", () => client.operations.cancelListSelection());
}

let prevCount = 0;
client.subscribe(() => {
  const c = (S()["chat.messages"] || []).length;
  if (c !== prevCount) { lastInbound = Date.now(); prevCount = c; }
  render();
});
render();

window.__askmavis = { trace, state: S, rows, send, login }; // inspection hook for headless tests
