// Login = answer the Greeting playbook's own "Would you like to sign in?" ask (Greeting 6ab9e1c2,
// section "Enrich sign-in & profile"). Picking "Yes" runs the OAuth-gated
// "Greeting - Get Enrich profile (Login via Ada)" action, so Ada itself asks for the Enrich sign-in.
// These helpers are pure so both pages (host SDK messages and bridge rows) can share them.

const SIGN_IN_Q = /sign in/i;

/** messages: [{ id, sender: "bot"|"user", type, body, replies: [{label}] }] (normalised). */
export function findSignInAsk(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender === "user") return null; // the customer has already moved past it
    if (m.type !== "quick_replies") continue;
    const yes = (m.replies || []).findIndex((r) => /^yes\b/i.test(r.label || ""));
    const no = (m.replies || []).findIndex((r) => /^no\b/i.test(r.label || ""));
    if (yes < 0 || no < 0) continue;
    const prev = messages[i - 1];
    if (SIGN_IN_Q.test(m.body || "") || (prev && prev.sender === "bot" && SIGN_IN_Q.test(prev.body || ""))) {
      return { message: m, yes, no };
    }
  }
  return null;
}

/** True once the Greeting's signed-in branch has greeted the customer by name
 *  ("Good Evening Mr Tan!" = time of day + title + last name; guests only get "Good Evening!"). */
export function looksSignedIn(messages, sinceIndex = 0) {
  return messages.slice(sinceIndex).some((m) => {
    const t = (m.body || "").trim();
    return m.sender === "bot" && m.type === "text" && /^good (morning|afternoon|evening)\s+\S+\s+\S+/i.test(t) && t.length < 80;
  });
}
