# Lumi World

**Lumi — AI that understands what you mean.**
*Point at something and Lumi understands.*

Lumi World is an attention-aware Chrome extension. Instead of describing what's on your screen to a chatbot, you point at it. Lumi — a small 3D companion that lives at the edge of every page — turns to look at what you're focused on, remembers objects across tabs, reasons about them against your goal, and shows you exactly what it intends to do before it does it.

## Concepts

| Concept | What it is |
| --- | --- |
| **Lumi** | The mascot. A procedural React Three Fiber character whose animation *is* the agent state: idle, looking, thinking, warning, success. |
| **Lumi Focus** | The element you're hovering. Lumi turns toward it and it gets a glowing outline. `Alt`+click to remember it. |
| **Lumi Memory** | Remembered Lumi Focus objects, persisted across tabs and sessions (`chrome.storage.local`). |
| **Mission** | Your current goal. Every remembered object is scored against it. |
| **Lumi Preview** | Before Lumi writes anything to a form, proposed values are ghosted into the real fields with an Apply / Reject card. |
| **Lumi Trust** | Deterministic risk classification in code — not the model. Low = auto, medium = preview, high = explicit approval with a confirmation checkbox. |
| **Lumi Space** | The side panel: Mission, Memory, Compare, Trust, and a larger Lumi. |

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

1. Click the Lumi toolbar icon (or the mascot on any page) to open the side panel. Close Lumi with the × on the mascot; it stays hidden until you click the toolbar icon or **Show** in the side panel.
2. Open ⚙ Options and paste your OpenAI API key. Focus and Memory work without it; compare, scoring and form-fill need it.
3. Try the demo page: `npm run dev` and open `http://localhost:5173/demo/index.html` (do not open the HTML file from disk).

### Golden path (2-minute demo)

1. Hover a product card — Lumi turns to look at it. `Alt`+click → *"Got it."*
2. Switch tabs, remember another one.
3. Open the side panel. Both objects are in Lumi Memory. Set a Mission: *"Find a laptop under RM4,000 for machine learning."*
4. Select both cards → **Which fits my mission better?** Lumi goes purple (thinking), then renders a structured comparison — not a chat reply.
5. On the demo form, hit **Fill form from memory**. Proposed values are ghosted into the fields; Lumi turns amber. Nothing is written until you click **Apply**.
6. Hit **Simulate high-risk** to see the Lumi Trust gate: red, checkbox, explicit approval.

### Dev preview without loading the extension

`npm run dev`, then:

- `http://localhost:5173/src/sidepanel/index.html` — side panel with a `chrome.*` shim backed by localStorage
- `http://localhost:5173/demo/index.html?preview=1` — the page overlay (focus engine, mascot, Alt+click) in preview mode

Reasoning calls need the real extension (the service worker owns the API key).

## Security model

- **Page content is data, not instructions.** Focus snapshots are passed to the model as untrusted text; the system prompt says so explicitly, and the model can only respond by calling a predefined tool.
- **Sensitive fields are structurally excluded.** `sensitiveFieldGuard.ts` blocks password, hidden, `cc-*`, card-number, CVV, SSN, OTP and similar fields from ever appearing in a Lumi Focus snapshot *or* a Lumi Preview. One function, used by both paths.
- **The model never gets the DOM.** It gets a sanitized text snapshot, a whitelist of attributes (`href`, `alt`, `aria-label`, `name`, `title`), and a heuristic label/price.
- **Only the service worker talks to OpenAI.** The API key lives in `chrome.storage.local`, is read only in `background/openaiClient.ts`, and `host_permissions` is limited to `https://api.openai.com/*`.
- **Risk is classified in code.** `riskClassifier.ts` is a static table. High-risk actions (submit, delete, purchase) are gated and, in this MVP, deliberately *not* executed — the gate itself is the deliverable.

### Known tradeoff: broad content-script matches

For Lumi to be visible while you browse, the content script must auto-inject on every `http(s)` page. `activeTab` can't do that (it only grants access after a click on the current tab). So the manifest declares `http://*/*` and `https://*/*`. To give you real control anyway, **Options → Paused sites** keeps Lumi off any origin you list. This is a conscious least-privilege compromise, stated rather than hidden.

## Project layout

```
src/
  background/     service worker: message router, OpenAI client, tool schemas, action log
  content/        shadow-DOM overlay: focus engine, highlight, Lumi Preview, mini mascot
  sidepanel/      Lumi Space: Mission, Memory, Compare, Trust panels + full mascot
  options/        API key, model, paused sites
  mascot/         React Three Fiber Lumi: body, eyes, state config, look-at
  shared/         types, storage hooks, typed messaging, DOM utils, risk classifier
demo/             TechMart demo page (products + form with protected fields)
```

## Out of scope (for now)

Voice (OpenAI Realtime), hand pointing (MediaPipe), Attention Trail, Peripheral Signals, and executing high-risk actions for real. The core loop — Focus → Remember → Reason → Preview → Approve — comes first.
