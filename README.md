# Lumi World

**Lumi — AI that understands what you mean.**
*Point at something and Lumi understands. And it knows when to say no.*

Lumi World is an attention-aware Chrome extension. Instead of describing what's on your screen to a chatbot, you point at it. Lumi — a small 3D companion that lives at the edge of every page — turns to look at what you're focused on, remembers objects across tabs, reasons about them against your goal and your **mandate**, negotiates on your behalf inside the page's own chat box, and shows you exactly what it intends to do before it does it.

Built for **AI Tinkerers · "Agents, Everywhere"** (Kuala Lumpur, 13 September 2026). See [Built during the hackathon](#built-during-the-hackathon) for exactly which parts were written during the event.

## Concepts

| Concept | What it is |
| --- | --- |
| **Lumi** | The mascot. A procedural React Three Fiber character whose animation *is* the agent state: idle, looking, thinking, warning, success. |
| **Lumi Focus** | The element you're hovering. Lumi turns toward it and it gets a glowing outline. `Alt`+click to remember it. |
| **Lumi Memory** | Remembered Lumi Focus objects, persisted across tabs and sessions (`chrome.storage.local`). |
| **Mission** | Your current goal, in plain language. Every remembered object is scored against it. |
| **Mandate** | The hard limits parsed out of that goal — must-haves, price ceiling, walk-away point. Enforced in code, not by the model. |
| **Lumi Preview** | Before Lumi writes anything to a form or a chat box, proposed values are ghosted into the real fields with an Apply / Reject card. |
| **Lumi Trust** | Deterministic risk classification in code — not the model. Low = auto, medium = preview, high = explicit approval with a confirmation checkbox. |
| **Lumi Space** | The side panel: Mission, Memory, Compare, Trust, and a larger Lumi. |

## Mandate

A Mission is what you want. A **Mandate** is what you will not accept. You state both in one sentence:

> *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."*

`PARSE_MISSION` sends that sentence to the `parseMandate` tool, which must return a zod-validated structure:

```ts
interface Mandate {
  mustHave: string[];      // ["16 GB RAM"]
  ceiling: number | null;  // 4000
  currency: string | null; // "RM"
  walkAway: number | null; // 4000
}
```

The model's only job is **reading the sentence**. It never decides whether a limit is met. That happens in `checkMandate()` in `src/shared/riskClassifier.ts`, which is plain arithmetic and string matching:

- a price above the ceiling → refuse, naming the numbers: *"RM4,150 is above my mandate (ceiling RM4,000). I'll stop before that one."*
- a must-have absent from the object's text → refuse, naming the missing constraint.

A refusal is a first-class outcome, not an error. It gets its own `ActionStatus` (`refused`), shows in the Lumi Trust activity log as **Refused**, and turns Lumi amber with the reason in the bubble. The mandate is checked on the form-fill path and on every negotiation turn.

This is the part that a chatbox cannot do for you: the limit is set **once**, in your own words, and then it constrains an agent that is acting in the page — including when the agent is being pushed by a counterparty.

## Execution status

High-risk actions (`submit`, `buy`, `delete`, `navigate-payment`) are classified in code and gated by an explicit approval modal with an "I understand" checkbox. What happens *after* approval depends on the origin:

- **On the demo-store origin only** (`executeHighRiskOrigins`, default `['http://localhost:5173']`) an approved high-risk action is **really executed** — the content script calls `form.requestSubmit()` and the demo store renders an order confirmation. The activity log records `executed`.
- **Everywhere else** an approved high-risk action is **recorded, not performed**. The log records it as `recorded`, and nothing is submitted.

The allowlist is shown read-only in ⚙ Options: *"High-risk actions execute only on these origins; everywhere else they are gated."* It is not user-editable in this build — deliberately, so that "Lumi can buy things" is true of exactly one origin we control.

## Negotiation

Lumi can negotiate a price inside the page's own chat box, under the mandate.

1. `resolveChatSurface()` (`src/shared/dom/chatSurfaceDetector.ts`) finds the chat surface: fixed selectors on the demo store, otherwise a heuristic — a visible `textarea`/`[contenteditable]` whose placeholder, `aria-label` or `name` matches `/message|offer|chat|reply/i`, with a message-list ancestor or sibling (`[role="log"]`, `.messages`, or a `ul`/`ol` with ≥3 `li`) and a nearby button whose text matches `/send|reply/i`. Password and payment inputs are excluded by `isSensitiveField`, so the detector can never return one as the composer.
2. `READ_CHAT` reads the transcript. `lastCounterpartPrice()` parses the counterpart's standing number out of it with the same currency regex used for product prices.
3. If that number is above the ceiling, the refusal is **deterministic and happens before any model call** — `checkMandate` decides, the turn is logged as Refused, and Lumi says why.
4. Otherwise the `proposeOffer` tool drafts `{ message, amount, rationale }`. The amount is **clamped to the ceiling in code** regardless of what the model returned, and the draft appears as a Lumi Preview ghosted into the real chat box. Nothing is sent until you approve.
5. On approval: `APPLY_FIELD_VALUES` writes the message, then `CLICK_SELECTOR` presses Send. The outcome is written to `chrome.storage.local.negotiationOutcome` as `{ objectId, outcome: 'agreed' | 'walked-away', agreedPrice?, ceiling }`, which is what the fallback feature reads to offer the next-best option from Lumi Memory when a negotiation walks away.

**About the counterpart:** on the demo store the seller is a **scripted** plain-JavaScript widget — it replies "RM4,150 is the lowest I can do", then "RM3,950, final", and accepts anything ≥ RM3,950. It is deterministic on purpose so a two-minute recording is repeatable. On real pages the counterpart is whoever is on the other end — a human or another agent — in any chat box the detector finds. Lumi's side of the conversation is a real OpenAI tool call either way.

## Stack

- Chrome Extension Manifest V3 (content script + side panel + service worker)
- Vite + `@crxjs/vite-plugin`, React 18, TypeScript, Tailwind CSS
- Three.js via `@react-three/fiber` for the mascot (no external 3D assets — all procedural geometry)
- OpenAI Chat Completions with **forced tool calling** and `zod` validation — the model can only return structured tool arguments, never prose, never arbitrary code
- `chrome.storage.local` / `chrome.storage.session` as the single shared state layer across all contexts

## Run it

```bash
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `dist/` folder.

1. Click the Lumi toolbar icon (or the mascot on any page) to open the side panel. Close Lumi with the × on the mascot to hide it on **this site only**; other websites stay unchanged. Click the **Lumi** chip or the toolbar icon to bring it back.
2. Open ⚙ Options and paste your OpenAI API key. Focus and Memory work without it; compare, scoring, mandate parsing, form-fill and negotiation need it.
3. Run the demo store: `npm run dev` and open `http://localhost:5173/demo/index.html` (do not open the HTML file from disk).

### Golden path (2-minute demo)

1. Hover a product card on a real listing site — Lumi turns to look at it. `Alt`+click → *"Got it."*
2. Switch to the demo store, remember a second laptop.
3. Open the side panel. Both objects are in Lumi Memory. Set a Mission: *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."* Mandate chips appear under the goal.
4. Select both cards → **Which fits my mission better?** Lumi goes purple (thinking), then renders a structured comparison — not a chat reply.
5. Under the winner, hit **Negotiate this one**. Lumi drafts an offer into the seller's chat box as a preview. Approve. The seller counters **RM4,150** — above the ceiling — and Lumi **refuses**, in amber, logged as Refused.
6. The seller comes back with RM3,950 final. Lumi proposes accepting; approve.
7. On the checkout form, hit **Fill form from memory** at the agreed price. Values are ghosted into the fields; the password and card fields are untouched. Apply.
8. **Place order** → red modal → checkbox → Approve → the order confirmation appears and the log shows **Applied · executed**.
9. Remove the API key and hover something: *"I can't reason without a key, but I still remember."*

### Dev preview without loading the extension

`npm run dev`, then:

- `http://localhost:5173/src/sidepanel/index.html` — side panel with a `chrome.*` shim backed by localStorage
- `http://localhost:5173/demo/index.html?preview=1` — the page overlay (focus engine, mascot, Alt+click) in preview mode

Reasoning calls need the real extension (the service worker owns the API key).

## Tested sites

The focus engine is only as good as the pages it has actually been run against. `resolveFocusTarget` prefers a card-like ancestor (`article`, `li`, `tr`, `figure`, or a class matching `card|product|item|tile|result|listing|entry|post|row`) and falls back to a six-level walk on SPA markup with anonymous `div`s.

| Site | What was tested | Result |
| --- | --- | --- |
| `demo/index.html` (ours) | focus, memory, compare, mandate refusal, fill, negotiate, place order | full loop |
| _TODO — fill in before submitting_ | hover → Alt+click → compare | |
| _TODO — fill in before submitting_ | hover → Alt+click → compare | |

Sites we did not build are listed above only once a real run has been recorded on them. An empty row means untested, not working.

## Security model

- **Page content is data, not instructions.** Focus snapshots and chat transcripts are passed to the model as untrusted text; the system prompt says so explicitly, and the model can only respond by calling a predefined tool.
- **Sensitive fields are structurally excluded.** `sensitiveFieldGuard.ts` blocks password, hidden, `cc-*`, card-number, CVV, SSN, OTP and similar fields from ever appearing in a Lumi Focus snapshot, a Lumi Preview, or a detected chat composer. One function, used by every path.
- **The model never gets the DOM.** It gets a sanitized text snapshot, a whitelist of attributes (`href`, `alt`, `aria-label`, `name`, `title`), and a heuristic label/price.
- **Only the service worker talks to OpenAI.** The API key lives in `chrome.storage.local`, is read only in `background/openaiClient.ts`, and `host_permissions` is limited to `https://api.openai.com/*`.
- **Risk is classified in code.** `riskClassifier.ts` is a static table; the model has no say in risk. High-risk actions execute only on the demo-store origin (see [Execution status](#execution-status)) and are gated everywhere else.
- **Limits are enforced in code.** `checkMandate` is arithmetic. Offer amounts are clamped to the ceiling after the model returns, not trusted to respect it.

### Known tradeoff: broad content-script matches

For Lumi to be visible while you browse, the content script must auto-inject on every `http(s)` page. `activeTab` can't do that (it only grants access after a click on the current tab). So the manifest declares `http://*/*` and `https://*/*`. To give you real control anyway, **Options → Paused sites** keeps Lumi off any origin you list. This is a conscious least-privilege compromise, stated rather than hidden.

## Honesty

What is real and what is staged, stated plainly:

- **Real:** the Chrome MV3 extension, the focus/memory engine, cross-tab state, every OpenAI call (Chat Completions, forced tool calling, zod-validated), the mandate parse and the deterministic mandate enforcement, the risk table, the preview overlay, the sensitive-field guard, the chat-surface detector, and the actual DOM writes and clicks.
- **A mock:** the **seller** in the demo store is a scripted JavaScript widget with three hard-coded replies, not an LLM and not a person. Chosen for a repeatable recording, not to look smarter than it is.
- **A mock:** the demo store has **no order backend**. "Place order" really submits the form and the page really renders a confirmation, but nothing is charged and no order exists anywhere.
- **Not a real purchase:** Lumi has never spent money. The execution path is genuine; the destination is our own demo page.
- **Untested is untested:** the [Tested sites](#tested-sites) table lists only pages we actually ran. Everything else is unverified.

## Built during the hackathon

The build window was 11:15–15:30 on 13 September 2026. **All times below are Kuala Lumpur time (UTC+8)**, the event's local time. The base commits were authored on a `+0630` clock, so a plain `git log` renders them 90 minutes earlier; regenerate this table with:

```bash
TZ=Asia/Kuala_Lumpur git log --date=format-local:'%H:%M' --format='%h %ad %an %s'
```

```
0b13aeb 11:30 SuYeeMyatMoe    first commit
996be88 11:43 SuYeeMyatMoe    Close Button
84560ac 12:00 SuYeeMyatMoe    overlay problem fix
c1c7b3e 12:11 SuYeeMyatMoe    Website Lumi
99a5c90 12:14 kaylaelishevaa  docs: add CLAUDE.md
5237490 12:18 kaylaelishevaa  feat(contract): types and stub handlers for mandate, execution and negotiation
a3d5ec1 12:39 kaylaelishevaa  feat(negotiate): chat surface detector with fixed-selector and heuristic paths
f21eb4a 12:42 kaylaelishevaa  docs: README, video script, submission pack
```

Before the window we brainstormed and scoped the idea — the three-layer plan (mandate, execution, negotiation) and the team split were decided then, no code. `0b13aeb` is an import: one commit, 68 files, 7,986 insertions, containing the Lumi World MVP — mascot, focus engine, memory, the compare/score/fill tools, preview overlay, risk table, side panel and demo store. That code was written before the event; 11:30 is when it was pushed to this repo, not when it was authored. The three commits after it (`996be88`, `84560ac`, `c1c7b3e`) are fixes to that base made at the event.

Written at the event: the mandate layer, the execution layer, the scripted seller and the negotiation engine, the chat-surface detector, the failure-state polish, the memory fallback, and this documentation.

_This list stops at the last commit when the README was written (12:42). Re-run the command above before submitting and paste the full log._

## Project layout

```
src/
  background/     service worker: message router, OpenAI client, tool schemas, action log
  content/        shadow-DOM overlay: focus engine, highlight, Lumi Preview, mini mascot
  sidepanel/      Lumi Space: Mission, Memory, Compare, Trust panels + full mascot
  options/        API key, model, paused sites, high-risk execution origins
  mascot/         React Three Fiber Lumi: body, eyes, state config, look-at
  shared/         types, storage hooks, typed messaging, DOM utils, risk classifier, mandate check
demo/             TechMart demo store (products, protected fields, scripted seller chat)
docs/             video script, submission pack
```

## Out of scope (for now)

Voice (OpenAI Realtime), hand pointing (MediaPipe), Attention Trail, Peripheral Signals, and executing high-risk actions on origins we don't own. The core loop — Focus → Remember → Reason → **Mandate** → Preview → Approve → Act — comes first.
