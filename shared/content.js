// Everything a customer can click, copied from singaporeair.com/ai-mode/chat and re-pointed at
// Malaysia Airlines (KrisFlyer -> Enrich, SIN -> KUL). `send` is the exact text handed to Ada.

export const HANDLE = "malaysiaairlines-sandbox";

export const HERO = {
  title: "Hi there",
  lead: "Tell me where and when you’d like to travel. I’ll recommend flights.",
};

export const CARDS = [
  {
    title: "Find the lowest fares",
    sub: "For a 7-day trip from Kuala Lumpur",
    send: "Find me the lowest fares for a 7-day trip from Kuala Lumpur",
  },
  {
    title: "Enrich Points or cash?",
    sub: "KUL–Haneda Business, 10–17 Dec",
    img: "tokyo.jpg",
    send: "Should I use Enrich Points or cash for a Business class return trip from Kuala Lumpur to Tokyo Haneda, 10–17 Dec?",
  },
  {
    title: "Mixed itinerary planning",
    sub: "Award outbound, cash return: KUL–ICN",
    img: "seoul.jpg",
    send: "Help me plan a trip from Kuala Lumpur to Seoul Incheon with an Enrich award ticket outbound and a cash fare for the return",
  },
];

export const SMART_OPTIONS = [
  { title: "Flight Finder", sub: "Plan your trip with AskMavis", send: "I want to plan a trip and find flights" },
  { title: "Meals", sub: "Set your meal before you fly", send: "I want to choose my meal before I fly" },
];

export const PROMPTS = [
  { label: "What is AskMavis • BETA?", send: "What is AskMavis and what can you help me with?" },
  { label: "Claim missing Enrich Points", send: "I want to claim missing Enrich Points" },
  { label: "Change redemption nominee", send: "How do I change my Enrich redemption nominee?" },
  { label: "Update personal information", send: "I want to update my personal information on my Enrich account" },
  { label: "Enrich Points accrual eligibility", send: "Which flights and fares are eligible to earn Enrich Points?" },
  { label: "Enrich milestone rewards / tier rewards", send: "What are the Enrich milestone and tier rewards?" },
];

export const FEEDBACK_TEXT = "I would like to share feedback about my experience";

// Typed when the Greeting's own sign-in question is no longer on screen (see login.js).
export const LOGIN_TEXT = "I would like to sign in to my Enrich account";

export const TERMS_URL = "https://www.malaysiaairlines.com/hq/en/terms-and-conditions.html";
