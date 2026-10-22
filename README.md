# AskMavis AI Mode

Mockups of a Singapore Airlines–style "AI Mode" chat for Malaysia Airlines, driven by the
`malaysiaairlines-sandbox` Ada AI agent through Ada's **Messaging Web SDK**.

| Page | URL | What it shows |
| --- | --- | --- |
| Custom app | https://jiapengchua.github.io/askmavis/custom-app/ | Our own conversation UI, loaded by Ada into its frame (`appUrl`). Ada keeps the session and the AI agent; we draw everything you see. |
| Ada window | https://jiapengchua.github.io/askmavis/ada-window/ | Ada's own chat window placed in the page (`parentElement`), with the SQ hero, cards and Smart Options around it. |

Both pages copy SQ's layout and options: the AI Mode bar (Flight Finder · Login · feedback),
the "Hi there" hero with three prompt cards, the composer, and the **View Smart Options** panel.
KrisFlyer → Enrich and SIN → KUL. Every option sends a fixed phrase to Ada; the phrases are in
[shared/content.js](shared/content.js).

## Login

Login reuses the **Greeting** playbook (`6ab9e1c2`). It opens every conversation with
*"Would you like to sign in?"* (Yes / No), and **Yes** runs the OAuth-gated
*Greeting – Get Enrich profile (Login via Ada)* action. Ada then sends a `sign_in` message, and
that leads to the real Enrich (Azure B2C, UAT) login.

- **Question still on screen:** Login answers **Yes** (`selectQuickReply`).
- **Conversation has moved on:** the page calls `reset()` for a fresh conversation, then answers
  the new Greeting's question with Yes. Like SQ, logging in starts you over.
- **Custom app:** the app draws Ada's `sign_in` message as an Enrich card. Its button opens
  `authLink` in a popup.
- **Ada window:** Ada shows its own **Sign In** button.

What we tried and dropped, all tested live:

- Typing "sign in to my Enrich account" in the middle of a chat. Sometimes Mavis asks the
  sign-in question; sometimes it only gives a knowledge-base link to the Enrich website.
- `triggerGreeting()`. It does nothing once a greeting has been sent.
- `startNewConversation()` (custom app). It closed the chat without opening a new one, and the
  next message hung with no reply.

## Cards and the Greeting's pending question

If a card's question is sent while the sign-in question is still waiting, it doesn't always work.
In 1 of 3 live runs Mavis repeated the sign-in question and dropped the card's question. So the
pages first answer **No**, wait for the Greeting to finish, then send the card text. The custom
app hides the Greeting behind the hero, so the thread starts at the customer's own question.

## Query flags

- `?reset` starts a fresh Ada conversation on load. Useful for demos, because Messaging keeps
  the conversation across reloads.
- `?debug` (Ada window only) logs SDK events to the console.
- `?direct` (Ada window only) sends card text straight into the pending sign-in question, for
  comparison.

`window.__askmavis` holds the message mirror and a trace, for headless testing.

## Requirements and notes

- `https://jiapengchua.github.io` is on the sandbox's allowed websites, which covers both the
  embedding page and the custom app's origin. Any other host needs adding there.
- The bridge loader is copied from `@ada-cx/messaging-bridge@1.12.0` into
  [custom-app/app/](custom-app/app/). The bridge runtime itself always loads from Ada's CDN.
- GitHub Pages caches files for 10 minutes, so a fresh deploy can take that long to show up.
- Fonts: Montserrat (free stand-in for MAS's Gotham) and Cormorant Garamond (for IvyMode).
  Destination photos are from Wikimedia Commons.
- Ada demo mockup, not an official Malaysia Airlines page.
