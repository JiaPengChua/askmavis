// /ada-window/ — Ada's default conversation app mounted inline (parentElement) on the Messaging
// Web SDK. Cards, Smart Options and the feedback icon call sendMessage(); Login answers the
// Greeting's sign-in question through selectQuickReply().
import { createAdaEmbedInterface } from "https://messaging-assets.ada.support/sdk.js";
import { HANDLE, FEEDBACK_TEXT, LOGIN_TEXT } from "../shared/content.js";
import { buildBar, buildHero, buildPanel, disclaimerHtml, toast, MH_HEADER } from "../shared/chrome.js";
import { findSignInAsk, looksSignedIn } from "../shared/login.js";

const ASSETS = "../assets/";
const params = new URLSearchParams(location.search);
const log = (...a) => { if (params.has("debug")) console.log("[askmavis]", ...a); trace.push([Date.now(), ...a]); };
const trace = [];

document.getElementById("mh-header").innerHTML = MH_HEADER(ASSETS);
document.getElementById("am-disclaimer").innerHTML = disclaimerHtml();
const panel = buildPanel(document.body, { onSend: send });
const bar = buildBar(document.getElementById("am-bar"), {
  onSmartOptions: () => panel.open(),
  onLogin: login,
  onFeedback: () => send(FEEDBACK_TEXT, "feedback"),
});
buildHero(document.getElementById("am-hero"), { onSend: send, assetBase: ASSETS });
const note = document.getElementById("am-note");
const showNote = (t) => { note.textContent = t; note.hidden = false; };

/* ---------- transcript mirror (host-page view of the conversation) ---------- */
const messages = []; // normalised: { id, sender, type, body, replies, createdAt }
const norm = (m) => ({
  id: m.id,
  sender: m.role === "user" ? "user" : m.role === "agent" ? "agent" : "bot",
  type: m.type,
  body: m.body || "",
  replies: (m.data && m.data.quickReplies) || [],
  createdAt: m.createdAt,
});
function upsert(m) {
  const n = norm(m);
  const i = messages.findIndex((x) => x.id === n.id);
  if (i >= 0) messages[i] = n; else messages.push(n);
  onTranscript();
}
let quietTimer, lastInbound = 0;
const settled = (quietMs = 2200, capMs = 12000) =>
  new Promise((resolve) => {
    const start = Date.now();
    (function check() {
      const idle = Date.now() - lastInbound;
      if (idle >= quietMs || Date.now() - start >= capMs) return resolve();
      setTimeout(check, 250);
    })();
  });

const waitFor = (fn, ms) => new Promise((resolve) => {
  const t0 = Date.now();
  (function tick() { const v = fn(); if (v || Date.now() - t0 > ms) return resolve(v || null); setTimeout(tick, 300); })();
});

/* ---------- SDK boot ---------- */
const ada = createAdaEmbedInterface();
let ready = false;
const queue = [];
let loginMark = -1;

async function boot() {
  try {
    const mount = document.getElementById("ada-window");
    mount.innerHTML = "";
    await ada.start({
      handle: HANDLE,
      parentElement: mount,
      enableProgrammaticControl: true,
      metaFields: { askmavis_surface: "ada-window" },
      onAdaEmbedLoaded: () => {
        ada.subscribeEvent("ada:message:received", ({ message }) => { lastInbound = Date.now(); log("recv", message.type, message.body?.slice(0, 80)); upsert(message); });
        ada.subscribeEvent("ada:message:sent", ({ message }) => { log("sent", message.body); upsert(message); });
      },
    });
    if (params.has("reset")) { await ada.reset(); history.replaceState(null, "", location.pathname); }
    try { (await ada.getMessages()).forEach(upsert); } catch (e) { log("getMessages failed", e.message); }
    ready = true;
    log("ready");
    while (queue.length) { const [t, s] = queue.shift(); send(t, s); }
  } catch (e) {
    log("start failed", e);
    showNote(`Mavis could not start on this page (${e.message || e}). The page origin must be on malaysiaairlines-sandbox's Allowed websites list.`);
  }
}

/* ---------- actions ---------- */
let sending = false;
async function send(text, source) {
  if (!ready) { queue.push([text, source]); toast("Connecting to Mavis…"); return; }
  if (sending) return;
  sending = true;
  try {
    // The Greeting may still be waiting on "Would you like to sign in?". Sending straight into it is
    // a coin flip (live: answered 2/3, re-asked the sign-in question 1/3 and dropped the card), so
    // answer "No" first, let the Greeting finish, then ask. ?direct skips this for comparison.
    const ask = findSignInAsk(messages);
    if (ask && !params.has("direct")) {
      log("declining pending sign-in ask before", source);
      await ada.selectQuickReply(ask.message.id, ask.no);
      lastInbound = Date.now();
      await settled();
    }
    await sendWithRetry(text);
  } catch (e) {
    log("send failed", e.message);
    toast("Mavis is busy — try again in a moment");
  } finally {
    sending = false;
  }
}
async function sendWithRetry(text, tries = 4) {
  for (let i = 0; ; i++) {
    try { return await ada.sendMessage(text); }
    catch (e) {
      if (i >= tries || !/RATE_LIMITED|not ready|timed? ?out/i.test(e.message || "")) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

async function login() {
  if (!ready) { toast("Connecting to Mavis…"); return; }
  if (looksSignedIn(messages)) { toast("You're signed in to Enrich"); return; }
  bar.setLogin("busy");
  loginMark = messages.length;
  armLoginTimeout();
  try {
    let ask = findSignInAsk(messages);
    if (!ask) {
      // The Greeting's question has scrolled past. Typing "sign in" mid-chat is unreliable (it can
      // get a knowledge answer pointing at the Enrich website) and triggerGreeting() is a no-op once
      // a greeting was sent, so start a fresh conversation — like SQ, where login reloads the page.
      log("login: fresh conversation for the Greeting's sign-in ask");
      toast("Starting a new chat to sign you in…");
      messages.length = 0;
      await ada.reset();
      loginMark = 0;
      ask = await waitFor(() => findSignInAsk(messages), 25000);
    }
    if (ask) {
      log("login: answering Greeting sign-in ask", ask.message.id);
      await ada.selectQuickReply(ask.message.id, ask.yes);
    } else {
      log("login: Greeting did not ask, falling back to a typed request");
      await sendWithRetry(LOGIN_TEXT);
    }
  } catch (e) {
    log("login failed", e.message);
    bar.setLogin("idle");
    toast("Couldn't start sign-in — try again");
  }
}

function onTranscript() {
  if (loginMark >= 0 && looksSignedIn(messages, loginMark)) { bar.setLogin("signed"); loginMark = -1; clearTimeout(loginTimer); }
}
let loginTimer;
const armLoginTimeout = () => { clearTimeout(loginTimer); loginTimer = setTimeout(() => { if (loginMark >= 0) { loginMark = -1; bar.setLogin("idle"); } }, 180000); };

document.getElementById("newchat").onclick = async () => {
  if (!ready) return;
  ready = false;
  messages.length = 0;
  bar.setLogin("idle");
  try { await ada.reset(); (await ada.getMessages()).forEach(upsert); } finally { ready = true; }
};

window.__askmavis = { messages, trace, send, login }; // inspection hook for the demo + headless tests
boot();
