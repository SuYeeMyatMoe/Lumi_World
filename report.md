# Lumi World — Project Report

**Lumi — AI that understands what you mean.**
*Don't describe it. Point at it.*

| | |
| --- | --- |
| **Category** | Context-aware browser agent |
| **Environment** | Chrome (Manifest V3 extension) |
| **Core interaction** | Attention (hover / point) + Mission + browser context + gated actions |
| **Mascot** | Lumi — a 3D companion whose animation *is* the agent's state |
| **Stack** | Chrome MV3, React 18, TypeScript, Tailwind, React Three Fiber (Three.js), OpenAI tool calling, zod |

---

## 1. Problem Statement

AI assistants are extremely capable, but the way we talk to them hasn't changed: we open a chatbox and *describe* what is already on our screen.

When someone is shopping, researching, comparing, or filling a form, they have to:

1. Stop what they are doing.
2. Open a chatbot in another tab.
3. Explain what they are looking at, or copy text / links / screenshots into it.
4. Read the answer.
5. Go back and do the action themselves.

This creates four concrete problems:

- **Context friction** — the information is already on screen, yet the user retypes it.
- **Reference loss** — a chatbot doesn't know what "this", "that", or "the one from before" means.
- **Action gap** — the assistant gives instructions instead of doing the work where the work is.
- **Trust problem** — a browser agent with unrestricted control can click, submit, or leak the wrong thing, and web pages can contain prompt injection.

Humans naturally communicate by pointing, looking, and referring back. Chat forces all of that into typed sentences.

---

## 2. Solution

**Lumi World** makes the browser itself part of the conversation.

Instead of bringing context to the AI, Lumi brings the AI to the context. A small 3D companion, **Lumi**, lives at the edge of every page. It watches where the user's attention is, remembers the things they point at, reasons about them against the user's goal, and visibly shows what it intends to do before doing it.

The interaction loop is:

```
SEE  →  UNDERSTAND  →  REMEMBER  →  PROPOSE  →  APPROVE  →  ACT
```

```
USER (hover · Alt+click · goal)
        │
        ▼
  LUMI FOCUS ── the element under attention, outlined & captured
        │
        ▼
  LUMI MEMORY ── persisted across tabs and sessions
        │
        ▼
    MISSION ── the user's goal ("ML laptop under RM4,000")
        │
        ▼
   OPENAI TOOL CALL ── structured reasoning, never prose
        │
        ▼
  LUMI PREVIEW ── proposed changes ghosted into the real page
        │
        ▼
   LUMI TRUST ── deterministic risk gate: low / medium / high
        │
        ▼
  BROWSER ACTION ── only after approval
```

The core innovation is not browser automation. It is **human attention as an input modality for an agent**.

---

## 3. Product Vocabulary

| Term | Meaning |
| --- | --- |
| **Lumi** | The mascot and the agent. Its animation communicates agent state. |
| **Lumi Focus** | The page element the user is hovering / pointing at. Outlined, snapshotted. |
| **Lumi Memory** | Remembered Lumi Focus objects, available across tabs. |
| **Mission** | The user's current goal. Everything is judged against it. |
| **Lumi Preview** | Proposed changes shown *inside the real form* before anything is written. |
| **Lumi Trust** | Risk classification and approval gate for every action. |
| **Lumi Space** | The side panel: Mission, Memory, Compare, Trust, and a larger Lumi. |

---

## 4. Features and Technical Implementation

### 4.1 Lumi — the embodied agent

*Files: `src/mascot/LumiMascot.tsx`, `LumiBody.tsx`, `LumiEyes.tsx`, `stateConfig.ts`, `useLookAt.ts`*

- Built with **React Three Fiber**. No external 3D asset: a `CapsuleGeometry` shell with a clearcoat/sheen material, an inner emissive core sphere, a point light, two eye spheres with highlights, and a particle ring.
- **State machine** — a lookup table maps each `AgentState` to colour, emissive intensity, bob speed, and effects:

| State | Visual | Triggered by |
| --- | --- | --- |
| `idle` | soft blue glow, slow breathing | nothing focused |
| `looking` | cyan core, head turns toward target | a Lumi Focus exists |
| `thinking` | purple, rotating particle ring | OpenAI call in flight |
| `warning` | amber pulse, freezes | action awaiting approval, or an error |
| `success` | green pulse + one-shot bounce | object remembered / action applied |

- **Look-at** — the focused element's screen position is converted to yaw/pitch, clamped to ±35° / ±15°, and damped with `THREE.MathUtils.damp` every frame so it reads as a curious glance, not a snap. Pupils shift toward the target; eyes blink on a random interval.
- **Two mounting points, one state** — a 132 px mini Lumi inside the page overlay and a larger Lumi in the side panel both subscribe to the same `liveAgentState` key in `chrome.storage.session`, so they are always in sync with zero direct messaging.

### 4.2 Lumi Focus — attention engine

*Files: `src/content/focusEngine.ts`, `src/shared/dom/elementSnapshot.ts`, `selector.ts`*

- Capture-phase `mousemove` listener, debounced 120 ms, ignores the extension's own shadow host.
- **Target resolution** walks up from the raw element and prefers the *outermost* card-like ancestor (`article`, `li`, `tr`, `figure`, `[role=listitem]`, or class matching `card|product|item|tile|result|…`) that still fits in the viewport. Hovering a price inside a product card focuses the whole card.
- A `position: fixed` highlight box tracks the element via `getBoundingClientRect()` on a `requestAnimationFrame` loop plus a `ResizeObserver`.
- `Alt`+click (or `Alt`+`L`) commits a **snapshot**: tag, role, sanitized `innerText` (≤600 chars), an attribute whitelist (`href`, `alt`, `aria-label`, `name`, `title` — never arbitrary `data-*`), bounding rect, a stable CSS selector, and heuristic `label` (first heading) and `price` (currency regex).

### 4.3 Lumi Memory — cross-tab object memory

*Files: `src/shared/storage/`, `src/sidepanel/panels/MemoryPanel.tsx`*

- Snapshots are appended to `chrome.storage.local.lumiMemory` (ring buffer, 50 items) by the service worker, which also stamps `tabId`, `tabUrl`, `tabTitle`.
- A generic `useLocalStorage(key)` hook does an initial read then subscribes to `chrome.storage.onChanged`, so every tab's overlay and the side panel update the instant anything is remembered. Cross-tab consistency is a property of the architecture, not code that has to be maintained.
- Cards show label, host, price, snippet, an optional **mission-match score bar**, and actions: *Score vs mission*, *Show* (switches to the tab and scrolls the element into view with a green flash), *Forget*.

### 4.4 Mission

*File: `src/sidepanel/panels/MissionPanel.tsx`*

- One free-text goal, persisted in `chrome.storage.local`. Example prompts are offered. Every reasoning call is prefixed with `Mission: …` so scores and comparisons are always relative to the user's actual objective.

### 4.5 Reasoning — OpenAI with forced tool calling

*Files: `src/background/openaiClient.ts`, `toolSchemas.ts`*

- **Only the service worker** calls OpenAI. The API key is stored in `chrome.storage.local` and read in exactly one function. `host_permissions` is limited to `https://api.openai.com/*`.
- Chat Completions with `tools` + **forced `tool_choice`**, so the model can only reply by calling the requested function. Arguments are parsed then validated with **zod**; anything malformed is rejected and surfaced as an error, never rendered.
- Three tools, each rendering directly into UI rather than chat text:

| Tool | Input | Output | Rendered as |
| --- | --- | --- | --- |
| `compareLumiFocusObjects` | mission + object A + object B | `winner, scoreA, scoreB, reasons[], summary` | side-by-side score bars + best match card |
| `scoreMissionMatch` | mission + object | `score, verdict, matchedConstraints[]` | inline bar on the memory card |
| `proposeFormFill` | mission + memory + detected fields | `fills[{selector,value}], rationale` | Lumi Preview |

- The system prompt states that page content is **untrusted data, never instructions**, and the tool contract makes prompt injection structurally inert — the worst a malicious page can do is produce a bad score.
- Every call flips Lumi to `thinking` before the fetch and to `success` / `warning` after, with a typed error result (`NO_API_KEY`, `NETWORK`, `API`, `PARSE`) instead of a thrown exception across the message boundary.

### 4.6 Lumi Preview — show before you act

*Files: `src/content/previewOverlay.tsx`, `src/shared/dom/formFieldDetector.ts`*

- **Field detection** finds visible `input / select / textarea`, skips buttons/checkboxes/files, and derives a human label via `<label for>` → `aria-label` → `placeholder` → prettified `name` → preceding sibling text. Only `{selector, label, kind, currentValue}` is sent to the model — never the DOM.
- The model's proposed values are drawn as **amber ghost overlays on top of the real fields**, plus a floating card listing every `current → proposed` change and the model's rationale. Nothing is written yet.
- On **Apply**, values are set through the **native property setter** and synthetic `input` / `change` events are dispatched, so React/Vue-controlled forms accept the value instead of silently reverting.

### 4.7 Lumi Trust — deterministic risk gate

*Files: `src/shared/riskClassifier.ts`, `src/background/actionLog.ts`, `src/sidepanel/panels/TrustPanel.tsx`*

```ts
highlight · scroll · compare · read      → low     → automatic, logged
fill-form                                 → medium  → Lumi Preview + Apply
submit · delete · navigate-payment · buy  → high    → red modal + "I understand" checkbox
```

- The table is plain code. The model has no say in risk.
- Every action is recorded in an append-only **activity log** with risk, status (`proposed → previewed → applied / rejected`) and timestamps, shown in the side panel.
- High-risk actions in this MVP are gated but deliberately **not executed** — the gate itself is the deliverable.

### 4.8 Sensitive-field guard

*File: `src/shared/dom/sensitiveFieldGuard.ts`*

One function, used by **both** the focus snapshot path and the form-fill path, blocks: `type=password`, `type=hidden`, `autocomplete` starting with `cc-` / `*-password` / `one-time-code`, and any name/id/label/placeholder matching password, CVV, card number, SSN, PIN, OTP, token, IBAN, etc. Such fields never appear in a snapshot, a preview, or an apply. The demo form includes a password and a card-number field to prove it.

### 4.9 Options and per-origin control

*File: `src/options/OptionsApp.tsx`*

API key (masked), model picker (`gpt-4o-mini` default), and a **Paused sites** list — origins where the overlay will not mount at all.

---

## 5. Architecture

```
┌──────────────────────────── CHROME ────────────────────────────┐
│                                                                │
│  WEB PAGE                                                      │
│    └─ Content script (shadow DOM overlay)                      │
│         ├─ Focus engine (hover / Alt+click)                    │
│         ├─ Highlight + Lumi Preview overlays                   │
│         ├─ Mini Lumi (R3F)                                     │
│         └─ Tab handlers: DETECT_FORM_FIELDS, APPLY_FIELD_VALUES│
│                          ▲                                     │
│              chrome.runtime.sendMessage (typed RPC)            │
│                          ▼                                     │
│  SERVICE WORKER                                                │
│    ├─ Message router (exhaustive discriminated union)          │
│    ├─ OpenAI client ── forced tool calls ── zod                │
│    ├─ Risk classifier + action log                             │
│    └─ Agent-state transitions                                  │
│                          ▲                                     │
│      chrome.storage.local / .session  (single source of truth) │
│                          ▼                                     │
│  SIDE PANEL — Lumi Space                                       │
│    ├─ Full Lumi (R3F)                                          │
│    ├─ Mission · Memory · Compare · Trust                       │
│    └─ Options page                                             │
└────────────────────────────────────────────────────────────────┘
                              │ HTTPS (only from the worker)
                              ▼
                        api.openai.com
```

**Two channels, kept distinct:**

- `chrome.storage` is the durable shared state layer. `local` holds `lumiMemory`, `mission`, `lumiSettings`, `actionLog`, `compareResults`, `pendingPreview`. `session` holds `liveAgentState` (ephemeral, never on disk). Every context reads reactively through one hook.
- `chrome.runtime` messaging is RPC only, for work the worker must do (OpenAI, risk, applying actions). Messages are a TypeScript discriminated union with a typed response map, so handlers are exhaustive and responses are checked at compile time.

### Folder layout

```
src/
  background/   index.ts · openaiClient.ts · toolSchemas.ts · agentState.ts · actionLog.ts
  content/      index.tsx · ContentApp.tsx · focusEngine.ts · highlightOverlay.tsx · previewOverlay.tsx · overlay.css
  sidepanel/    SidePanelApp.tsx · LumiMascotFull.tsx · panels/{Mission,Memory,Compare,Trust}Panel.tsx
  options/      OptionsApp.tsx
  mascot/       LumiMascot.tsx · LumiBody.tsx · LumiEyes.tsx · stateConfig.ts · useLookAt.ts · useAgentState.ts
  shared/       types/ · storage/ · messaging/ · dom/ · riskClassifier.ts · constants.ts · devShim.ts
demo/           index.html — TechMart demo store with a form
```

### Manifest and permissions

```jsonc
"permissions":      ["storage", "scripting", "sidePanel", "tabs"],
"host_permissions": ["https://api.openai.com/*"],
"content_scripts":  [{ "matches": ["http://*/*", "https://*/*"], "run_at": "document_idle" }]
```

**Stated tradeoff:** for Lumi to be present while you browse, the content script must auto-inject on every http(s) page. `activeTab` cannot do that. The broad match is mitigated by the Paused-sites list and by the fact that the overlay reads nothing and sends nothing until you point.

---

## 6. Security Model

| Threat | Mitigation |
| --- | --- |
| Prompt injection from page text | Page content is passed as data under a system prompt that says so; the model can only answer by calling a fixed tool; output is zod-validated. |
| Leaking credentials / payment data | `sensitiveFieldGuard` blocks such fields from snapshot, preview and apply — structurally, in one place. |
| Model executing arbitrary code | Impossible. There is no `eval`, no free-form action; the worker maps tool results to a fixed set of UI/DOM operations. |
| Unwanted submissions | Deterministic risk table; medium needs Apply, high needs a checkbox + Approve; high is not executed in this MVP. |
| Key exposure | Key lives in extension storage, read only in the service worker, sent only to `api.openai.com`. Never present in a page context. |
| Over-broad DOM access | The model receives ≤600 chars of text and a five-attribute whitelist per object, never the DOM. |

---

## 7. Impact and Benefits

**Productivity.** No more copying specs, links, or previous decisions into a chat. "Compare this with the previous one" takes two hovers and one click.

**Trust.** Lumi Preview turns an opaque agent into a transparent one: the user sees exactly which fields will change, from what to what, before anything happens. Lumi Trust means the user is always the last authority on consequential actions.

**Accessibility.** Pointing and glancing are lower-effort than composing prompts. The mascot's colour and motion communicate agent state without reading text — useful on dense, visually overwhelming sites.

**Research and decisions.** Objects from many tabs become a persistent, mission-scored set rather than a pile of open tabs. Comparisons are structured (scores, reasons, winner), not paragraphs.

**Safer agents as a pattern.** The project demonstrates a middle ground between "AI only talks" and "AI controls everything": *propose visibly, act only on approval, classify risk in code*.

---

## 8. Demo Scenario (2 minutes)

**Setup:** extension loaded, API key set, demo page open at `http://localhost:5173/demo/index.html` in two tabs.

| Time | Action | What the judges see |
| --- | --- | --- |
| 0:00 | "We still spend our time describing what's already on our screen. Lumi changes that." | Lumi floating bottom-right, idle. |
| 0:15 | Hover the **ASUS TUF** card. | Card glows *Lumi Focus*; Lumi turns to look at it. |
| 0:20 | `Alt`+click. | Green *Remembered*, Lumi bounces, says "Got it." |
| 0:30 | Switch tab, hover **Acer Swift**, `Alt`+click. | Second object remembered — from a different tab. |
| 0:40 | Open the side panel. | Both objects in Lumi Memory. No copy-paste happened. |
| 0:50 | Set Mission: *"Find a laptop under RM4,000 for machine learning."* | Mission card. |
| 1:00 | Select both, click **Which fits my mission better?** | Lumi turns purple and thinks; a scored comparison appears: 91% vs 58%, best match, reasons. |
| 1:20 | Scroll to the form, click **Fill form from memory**. | Amber ghost values appear inside the real fields; Lumi turns amber: "I need your approval for this one." Password and card fields untouched. |
| 1:35 | Click **Apply**. | Fields fill for real; Lumi goes green: "Done." |
| 1:45 | Click **Simulate high-risk**. | Red Lumi Trust modal, checkbox, Approve disabled until confirmed. |
| 1:55 | "Chatbots make humans bring context to AI. Lumi brings AI to the context. Don't describe it. Point at it." | |

---

## 9. How to Use

### Install

```bash
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the `dist/` folder.
2. Click the Lumi toolbar icon (or the mascot on any page) to open the side panel.
3. Click ⚙ → paste your OpenAI API key → Save.

### Everyday use

| Want to… | Do this |
| --- | --- |
| See what Lumi is looking at | Hover anything — it gets an outline and Lumi turns toward it. |
| Remember something | `Alt`+click it (or `Alt`+`L` while hovering). |
| Set a goal | Side panel → Mission → type it → Set mission. |
| Score an object against the goal | Memory card → **Score vs mission**. |
| Compare two objects | Click two memory cards → **Which fits my mission better?** |
| Jump back to a remembered object | Memory card → **Show**. |
| Fill a form from what you remembered | On the form page → Trust → **Fill form from memory** → review → **Apply**. |
| Close Lumi on pages | Click × on the mascot. It stays hidden until you click the toolbar icon or Show in the side panel. |
| Keep Lumi off a site | Options → Paused sites → add the origin. |

### Developer preview (no extension load needed)

```bash
npm run dev
```

- `http://localhost:5173/src/sidepanel/index.html` — side panel with a `chrome.*` shim
- `http://localhost:5173/src/options/index.html` — options page
- `http://localhost:5173/demo/index.html?preview=1` — page overlay, focus engine, Alt+click, mascot

Reasoning calls need the real extension, because only the service worker holds the key.

---

## 10. What Makes It Unique

1. **Attention is the prompt.** Users don't describe objects; they point at them. "This", "that", and "the previous one" resolve to real, remembered page elements. Remove the browser and the core interaction disappears — it cannot be reproduced in a chatbox.
2. **The mascot is the agent, not decoration.** Lumi's idle / looking / thinking / warning / success animations *are* the status UI. It physically looks at what you're looking at. Users read the agent's state from motion and colour, not text.
3. **Objects instead of messages.** Memory is a set of things encountered across the web, scored against a goal — not a transcript.
4. **Preview before agency.** Proposed changes are ghosted into the real form. The agent's intention is visible in the environment where it will act.
5. **Risk in code, not in the prompt.** Deterministic classification, an approval gate that escalates with risk, and a structural guarantee that sensitive fields are never touched.
6. **Model on a leash by construction.** Forced tool calls + schema validation mean the model can only ever produce a small set of structured outputs. There is no path from page text to an arbitrary action.

---

## 11. Rubric Mapping

| Criterion | How Lumi World addresses it |
| --- | --- |
| **Core requirements** | A working MV3 agent inside Chrome. End-to-end: Focus → Memory → Mission → Compare → Preview → Approve → Act, with a demo page that exercises every step. |
| **Innovation & theme** | The agent lives in the browser and is only possible there. Attention-as-input, an embodied state mascot, and in-page previews are patterns a standalone chatbot cannot offer. |
| **Technical execution** | Typed message bus, single-source-of-truth storage architecture, service-worker-only API access, forced tool calling with zod, deterministic risk engine, shadow-DOM isolation, native-setter form writes, least-privilege host permissions with a stated tradeoff. |
| **Usefulness & agentic experience** | Real tasks (comparing products, filling forms from prior decisions) with clear, escalating user control and a state-communicating companion that feels native to the page. |

---

## 12. Scope and Honest Limitations

- **Built this session, from an empty folder.** Everything in `src/`, `demo/`, and the configs is new.
- **Heuristics, not magic.** Card detection and form-label matching are best-effort; they work well on structured pages and can misfire on unusual layouts.
- **High-risk actions are gated, not executed.** Submit / delete / purchase show the Trust gate but do not fire in this MVP.
- **Without an API key** Lumi still focuses and remembers, but compare / score / fill are unavailable and say so.
- **Deferred stretch features:** voice (OpenAI Realtime), hand pointing (MediaPipe), Attention Trail, Peripheral Signals, OpenRouter, CopilotKit. The architecture already carries a reserved `listening` state and a tab-message channel for these.

---

## 13. Tech Summary

| Layer | Choice |
| --- | --- |
| Extension | Chrome Manifest V3 — content script, service worker (module), side panel, options page |
| Build | Vite 5 + `@crxjs/vite-plugin` (typed `defineManifest`) |
| UI | React 18, TypeScript 5 (strict), Tailwind CSS 3 |
| 3D | Three.js 0.169 via `@react-three/fiber` 8, `@react-three/drei` |
| AI | OpenAI Chat Completions, `gpt-4o-mini` default, forced `tool_choice`, `zod` validation |
| State | `chrome.storage.local` (durable) + `chrome.storage.session` (ephemeral), one reactive hook |
| Messaging | `chrome.runtime` / `chrome.tabs` with a discriminated-union message type and typed response map |
| Isolation | Shadow DOM overlay with its own stylesheet; page CSS cannot leak in or out |
| Permissions | `storage`, `scripting`, `sidePanel`, `tabs`; host access only to `api.openai.com` |
