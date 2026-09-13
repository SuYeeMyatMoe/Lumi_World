# CLAUDE.md — Lumi World (AI Tinkerers KL · Agents, Everywhere · 13 Sep 2026)

Read this before touching anything. It is the shared context for all three of us (AstraGirls) and for every Claude Code session on this repo today.

## 0. The situation

- Hackathon: "Agents, Everywhere" — AI Tinkerers global (48 cities), KL local event. Judged globally from a 2-min video + public repo, 1–5 on four criteria (below).
- Build window 11:15–15:30. **Feature freeze 14:15. Video 14:15–14:50. Submit by 15:20** (portal deadline 15:30 — an organizer may say otherwise; ask).
- Submission = title, written description, public GitHub repo, 2-min demo video, social post tagging the partners. Handbook: "be prepared to explain which parts were created during the hackathon."
- Decision made: **Lumi World is the product.** The other two team ideas are folded in as layers: **Mandate** (from "Agents That Say No"), **Execution** (from "FleetPulse"), **Negotiation** (from "Agents That Say No", full pattern, cut line 13:30).

## 1. Rubric — what we are optimising for

| Criterion | Score 5 says | Our proof in the video |
|---|---|---|
| Core requirements & functionality | robust, reliable, fully functional in its environment | full loop on a real site + demo store, ending in an executed purchase |
| Innovation & theme alignment | a surprising agent pattern whose value cannot be reproduced in a chatbox | pointing as input, cross-tab memory, in-page negotiation under a mandate |
| Technical execution & integration | exceptional engineering, robust orchestration, thoughtful failure handling | MV3 architecture, forced tool calls + zod, limits in code, failure states on camera |
| Usefulness & agentic experience | substantial value, context used intelligently, clear and controllable | compares, negotiates, fills, buys — limit set once, every consequential step approved, the refusal visible |

Rule of thumb: a working narrow demo beats a broad half-working one. Every criterion punishes a broken demo.

## 2. Repo map (verified against the code, 13 Sep)

```
manifest.config.ts        MV3 manifest via @crxjs (permissions: storage, scripting, sidePanel, tabs; host: api.openai.com only)
src/background/index.ts   service worker: registerMessageHandlers({...}) — FOCUS_HOVER, FOCUS_PINNED, REQUEST_COMPARE,
                          REQUEST_SCORE, REQUEST_FORM_FILL, REQUEST_HIGH_RISK_DEMO, APPLY_ACTION, REJECT_ACTION, ...
src/background/openaiClient.ts  callTool({tool, schema, userContent}) — ONLY place the API key is read; forced tool_choice; zod safeParse
src/background/toolSchemas.ts   TOOLS (compareLumiFocusObjects, scoreMissionMatch, proposeFormFill) + zod schemas
src/background/actionLog.ts     createAction(type,label,extra,status) / updateActionStatus / findAction — log capped at 100
src/background/agentState.ts    setAgentState / setFocusPos / flashSuccess / settleToIdle  (chrome.storage.session.liveAgentState)
src/shared/riskClassifier.ts    RISK_TABLE (static) + classifyRisk / requiresPreview / requiresExplicitApproval
src/shared/types/agentAction.ts ActionType, RiskLevel, ActionStatus ('proposed'|'previewed'|'approved'|'applied'|'rejected'), AgentAction
src/shared/types/messages.ts    RuntimeMessage / TabMessage discriminated unions + typed response maps; LumiError codes
src/shared/types/mission.ts     Mission { id, goal, createdAt, status }   ← mandate goes here
src/shared/storage/storageKeys.ts  LocalStorageSchema (lumiMemory, mission, lumiSettings, actionLog, compareResults, pendingPreview)
src/shared/storage/storage.ts   getLocal/setLocal/updateLocal (+ defaults), getSession/setSession
src/shared/dom/elementSnapshot.ts  resolveFocusTarget (card-like ancestor walk) + createSnapshot (PRICE_PATTERN, label, ≤600 chars)
src/shared/dom/formFieldDetector.ts detectFormFields / applyFieldValue (native setter + input/change events)
src/shared/dom/sensitiveFieldGuard.ts isSensitiveField — used by snapshot AND form-fill paths
src/content/index.tsx           shadow-DOM mount, paused-origins check, tab handlers DETECT_FORM_FIELDS / APPLY_FIELD_VALUES / HIGHLIGHT_SELECTOR
src/content/ContentApp.tsx      focus engine wiring, mini mascot, bubble, PreviewOverlay for this tab
src/content/previewOverlay.tsx  ghost values over real fields + Apply/Reject card; high-risk variant with checkbox
src/sidepanel/panels/{Mission,Memory,Compare,Trust}Panel.tsx
src/mascot/*                    React Three Fiber Lumi; stateConfig.ts maps AgentState → colour/motion
demo/index.html                 TechMart demo store (4 laptops, purchase-request form with password + cc-number fields)
```

State flows through `chrome.storage` (single source of truth, reactive `useLocalStorage` hook); `chrome.runtime` messaging is RPC only. Keep it that way — new features add a message type + a handler, not a new channel.

## 3. Known issues (verified)

1. **`npm run build` fails.** `src/background/index.ts:26` calls `setLocal('overlayVisible', true)` but `overlayVisible` is not a key of `LocalStorageSchema` → `tsc --noEmit` errors (TS2345), and `build` is `tsc --noEmit && vite build`. Nothing reads `overlayVisible`. Fix: delete that line (or add the key to `storageKeys.ts` + `storage.ts` defaults). `npx vite build` alone succeeds and produces a valid `dist/`.
2. `Lumi_3d_model.glb` (9 MB) is committed at the repo root but referenced nowhere; the README says the mascot is procedural. Remove it from the submission repo (`git rm --cached`, add to `.gitignore`) unless someone wires it in today.
3. `demo/index.html` form `onsubmit` calls `alert(...)`. A browser alert will block the extension and wreck the recording. Replace with an in-page confirmation block (part of the Execution layer).
4. High-risk actions are recorded, never executed (`APPLY_ACTION` comment). This is what the Execution layer changes — on the demo store only.
5. Build warning: the mascot chunk is ~820 kB (three.js). Ignore today.

## 4. Today's work, in priority order — one owner per task, one branch per task

**Team split (final, agreed ~12:15 — this overrides the owner names in the subsections below):**
- **Kayla — branch `negotiation`:** §4.0 build fix + contract, §4.1 Mandate, the scripted seller chat in `demo/index.html`, and Lumi's offer agent (all of §4.3). Execution (§4.2) only if everything else runs.
- **Third member — branch `fallback`:** when the seller says no / the negotiation walks away, Lumi finds the next-best option from Lumi Memory and offers to negotiate that one instead. Contract point: read `negotiationOutcome` from `chrome.storage.local` (`{ objectId, outcome: 'agreed' | 'walked-away', agreedPrice?, ceiling }`) — written by Kayla's handler; the fallback reacts to `'walked-away'`.
- **Lumi's author — branch `polish`:** her own fixes, failure states, real-site proof (§4.4).
- Everyone: branch from `main` after the contract commit is pushed; merge via pull request; `npm run build` must be green on `main` before recording.

Do them in this order. Nothing from §4.3 starts before §4.0–4.1 run.

### 4.0 Make the build green + freeze the contract (15 min) — owner: Kayla, first commits of the day
- Delete `src/background/index.ts:26` (`overlayVisible`). Run `npm run typecheck`, then `npm run build`.
- Add this file (`CLAUDE.md`) and commit. Tag: `git tag demo-safe`.
- **Contract commit** — so three people can work in parallel without merge conflicts in the shared files, all new types and stub handlers land in ONE commit before anyone else starts:
  - `src/shared/types/messages.ts`: `RuntimeMessage` add `{ type: 'PARSE_MISSION'; goal: string }` and `{ type: 'REQUEST_OFFER'; objectId: string }`; `TabMessage` add `{ type: 'SUBMIT_FORM'; selector: string }`, `{ type: 'READ_CHAT'; selector: string }`, `{ type: 'CLICK_SELECTOR'; selector: string }`; response maps accordingly; `LumiError['code']` add `'REFUSED'`; `DetectedFormField` results gain `formSelector`.
  - `src/shared/types/agentAction.ts`: `ActionType` add `'send-offer'`; `ActionStatus` add `'refused'`.
  - `src/shared/riskClassifier.ts`: `'send-offer': 'medium'`.
  - `src/shared/types/mission.ts`: `mandate?: {...}` (shape in §4.1). `src/shared/types/settings.ts`: `executeHighRiskOrigins: string[]` with default `['http://localhost:5173']`.
  - `src/shared/storage/storageKeys.ts` + `storage.ts` defaults: `negotiationOutcome: { objectId: string; outcome: 'agreed' | 'walked-away'; agreedPrice?: number; ceiling: number | null; updatedAt: number } | null` — the contract between the negotiation (writer) and the fallback feature (reader).
  - `src/background/index.ts` and `src/content/index.tsx`: stub handlers for the new messages returning `{ ok: false, code: 'UNKNOWN', error: 'not implemented' }`, so `npm run typecheck` is clean.
  - Commit `feat(contract): types and stub handlers for mandate, execution and negotiation`, push. After this, each owner only fills in their own handlers/files.

### 4.1 Mandate layer — owner: Kayla (branch `mandate`, target 12:40)
- `src/shared/types/mission.ts`: add `mandate?: { mustHave: string[]; ceiling: number | null; currency: string | null; walkAway: number | null }`.
- `src/background/toolSchemas.ts`: add `parseMandate` tool + `mandateSchema` (zod): `{ goal, mustHave: string[], ceiling: number|null, currency: string|null, walkAway: number|null }`. Same forced-tool pattern as the others.
- `src/shared/types/messages.ts`: add `{ type: 'PARSE_MISSION'; goal: string }` → `LumiResult<Mission>`; add `'REFUSED'` to `LumiError['code']`.
- `src/background/index.ts`: `PARSE_MISSION` handler — `setAgentState('thinking')`, `callTool({ tool: 'parseMandate', ... })`, store `mission` with `mandate`, `flashSuccess`. If `NO_API_KEY`, store the plain goal (mandate undefined) so nothing breaks without a key.
- `src/sidepanel/panels/MissionPanel.tsx`: `save()` sends `PARSE_MISSION` instead of `setLocal` directly; render mandate chips (must-have · ceiling · walk-away) under the goal.
- `src/shared/dom/price.ts` (new): move `PRICE_PATTERN` out of `elementSnapshot.ts`, export `parsePrice(text): number | null` (strip `RM`, commas).
- `src/shared/riskClassifier.ts`: add `checkMandate(input: { price?: number | null; text?: string }, mission: Mission | null): { ok: true } | { ok: false; reason: string }` — deterministic: `price > ceiling` → refuse with `"RM4,150 is above my mandate (ceiling RM4,000). I'll stop before that one."`; a must-have not found in `text` (case-insensitive) → refuse naming it. The model never decides this.
- `src/shared/types/agentAction.ts`: add `'refused'` to `ActionStatus`. `TrustPanel.tsx` `STATUS_LABEL`: `refused: 'Refused'`.
- `src/background/index.ts` `REQUEST_FORM_FILL`: after the model proposes fills, run `checkMandate` on the proposed price/model values (parse the fill for the budget/price field); on refusal → `createAction('fill-form', label, {}, 'refused')`, `setAgentState('warning', reason)`, `setTimeout(settleToIdle, 3000)`, return `{ ok: false, code: 'REFUSED', error: reason }`.
- `src/shared/constants.ts` `LUMI_VOICE`: add `refused: "That's above my mandate. I'll stop before that one."`.
- Verify: mission "ML laptop, 16 GB RAM, ceiling RM4,000" → chips appear; remember the MacBook Air (RM4,399) → Fill form from memory with it as the only memory → Lumi refuses, amber, logged as Refused.

### 4.2 Execution layer — owner: third member (branch `execute`, target 12:30), then README/video/post
- `demo/index.html`: (a) replace the `alert` with an in-page `#order-confirmation` block ("Order #4471 placed — ASUS TUF Gaming A15, RM3,950"); (b) add `Price (RM)` input to the form so the mandate check has a real field; (c) keep the password + card fields — they prove the guard on camera.
- `src/shared/types/messages.ts`: `TabMessage` add `{ type: 'SUBMIT_FORM'; selector: string }` → `TabResponseMap.SUBMIT_FORM: LumiResult<{ submitted: boolean }>`; `DetectedFormField` result gets `formSelector`.
- `src/content/index.tsx`: `SUBMIT_FORM` handler — `resolveSelector(selector)` → `form.requestSubmit()`.
- `src/shared/types/settings.ts`: add `executeHighRiskOrigins: string[]` (default `['http://localhost:5173']`). `OptionsApp.tsx`: show it read-only with the sentence "High-risk actions execute only on these origins; everywhere else they are gated."
- `src/background/index.ts`: rename `REQUEST_HIGH_RISK_DEMO` → `REQUEST_SUBMIT` (keep the same shape, add the real `formSelector` in `payload`). In `APPLY_ACTION`, for `action.type === 'submit'`: if the tab's origin is in `executeHighRiskOrigins` → `sendTabMessage(tabId, { type: 'SUBMIT_FORM', selector })`, log payload `{ executed: true }`; else `{ executed: false }` (recorded only, as today).
- `TrustPanel.tsx`: button label "Simulate high-risk" → "Place order"; activity row shows "executed" / "recorded".
- Verify: Apply fill → Place order → red modal → checkbox → Approve → confirmation block visible, log shows Applied · executed.

### 4.3 Negotiation layer — three owners (branch `negotiate`, **cut line 13:30**)
Kayla: engine (`proposeOffer` schema, `REQUEST_OFFER` handler, deterministic refusal). Lumi's author, after §4.4: extension wiring (`READ_CHAT` / `CLICK_SELECTOR` tab handlers in `src/content/index.tsx`, "Negotiate this one" button in `ComparePanel.tsx`, preview reuse). Third member, after §4.2: the scripted seller widget in `demo/index.html`.
- `demo/index.html`: `<section id="seller-chat">` with a message list (`.messages`), `<textarea name="offerMessage">`, Send button, and a **scripted** seller (plain JS, deterministic): first reply "RM4,150 is the lowest I can do", second reply "RM3,950, final", accepts ≥ RM3,950. Deterministic beats an LLM for a 2-minute take. README says the seller is scripted.
- `src/background/toolSchemas.ts`: `proposeOffer` tool + `offerSchema`: `{ message: string; amount: number; rationale: string }`.
- `src/shared/types/messages.ts`: `TabMessage` add `{ type: 'READ_CHAT'; selector: string }` → transcript text; `{ type: 'CLICK_SELECTOR'; selector: string }`. `RuntimeMessage` add `{ type: 'REQUEST_OFFER'; objectId: string }`.
- `src/shared/types/agentAction.ts` + `riskClassifier.ts`: add `'send-offer'` → `medium`.
- `src/background/index.ts` `REQUEST_OFFER`: context = mission + mandate + winner object + transcript (READ_CHAT). If the seller's last counter parses to a price above the ceiling → **deterministic refusal** via `checkMandate` (no model call), log Refused, bubble the reason. Otherwise call `proposeOffer`; clamp `amount ≤ ceiling` in code; create a `send-offer` action and a `LumiPreview` whose single change targets the textarea (reuse `previewOverlay` as-is). On `APPLY_ACTION` for `send-offer`: `APPLY_FIELD_VALUES` then `CLICK_SELECTOR` on the Send button.
- `ComparePanel.tsx`: under the winner, a button "Negotiate this one" → `REQUEST_OFFER`.
- Verify: one unbroken run offer → seller counter above ceiling → refusal → seller final → accept → checkout at RM3,950. If this does not run cleanly by 13:30, drop it: the video keeps the refusal at checkout instead.

### 4.4 Failure states + real-site proof — owner: Lumi's author (branch `polish`, target 13:00)
- Error paths already exist (`NO_API_KEY`, `NETWORK`, `API`, `PARSE` → `warning` + bubble). Add distinct `LUMI_VOICE` lines for `NETWORK` and `PARSE`, and make sure the bubble is readable for ≥3 s on camera.
- Test hover → remember → compare on two real listing pages you did not build. `resolveFocusTarget` prefers `article/li/tr/figure` or class `card|product|item|tile|result|listing|entry|post|row`; SPA sites with anonymous divs fall back to the 6-level walk. Fix only what breaks on the site you will record. Note the tested sites in the README.

### 4.5 Repo hygiene + README — owner: third member (from 13:00)
- README: update "high-risk not executed" → "executes on the demo store origin, gated everywhere else"; add sections **Mandate**, **Built during the hackathon** (list against `git log`), **Tested sites**, **Honesty**: seller agent and order backend are demo-store mocks; OpenAI calls are real.
- Remove the GLB (see §3.2). Add `docs/` for the video script if useful.
- **History honesty.** The final repo's history must be true. The base import keeps its real commit (or is one import commit whose message says what it is and when it was built); today's work is committed incrementally by whoever did it, under their own name. Do not split the base into invented feature commits and do not alter dates — the original repo is public with its own timestamps, and the handbook says teams must be ready to explain which parts were created during the event. A truthful "Built during the hackathon" section is worth more than a pretty log.

## 5. Final 2-minute scenario (what 14:15–14:50 records)

0:00 hook → 0:10 hover + Alt+click on a real site → 0:22 second laptop on the demo store → 0:32 Mission "ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it" → chips → 0:42 Compare, winner → 0:55 Chat with seller, Lumi drafts RM3,800, Approve → 1:02 seller "RM4,150" → **1:06 Lumi refuses: "RM4,150 is above my mandate. I'll stop before that one."** → 1:10 seller "RM3,950 final", Lumi proposes accept, Approve → 1:18 Fill checkout at RM3,950, ghost values, password/card untouched, Apply → 1:30 Place order, red modal, checkbox, Approve, order confirmed → 1:44 remove the API key, hover: "I can't reason without a key, but I still remember." → 1:50 close: "Chatbots make you bring context to AI. Lumi brings AI to the context — and it knows when to say no."

Record with the branch that runs at 14:15. Never with something merged after. `demo-safe` tag = the fallback build.

## 6. Working rules for Claude Code sessions on this repo

- One owner per file today. Do not edit files owned by another task; if you must, say so in the commit message and ping the owner.
- Small diffs. After every change: `npm run typecheck`. Before every commit: `npm run build`.
- Keep the architecture: storage is state, messages are RPC, the model only ever returns a zod-validated tool call, risk and mandate limits live in code.
- Never put an API key in the repo. `.env*` is ignored; keys live in the extension Options page only.
- Do not start anything in §4.3 before §4.0–4.2 run end to end.

## 7. Run / verify

```bash
npm install            # once per clone
npm run typecheck      # must be clean
npm run build          # produces dist/
# Chrome → chrome://extensions → Developer mode → Load unpacked → dist/
npm run dev            # serves http://localhost:5173/demo/index.html for the demo store
```
Reasoning calls need the real extension loaded (only the service worker holds the key). The content script injects on `http://localhost:5173` like any other page.

## 8. Commit protocol (one commit per task, in this order)

1. `fix(build): drop stray overlayVisible write so tsc passes` + `docs: add CLAUDE.md` — Kayla
2. `chore: remove unused 9 MB GLB asset` — Kayla
3. `feat(contract): types and stub handlers for mandate, execution and negotiation` — Kayla, pushed before others start
4. `feat(mandate): parse mission into mandate; enforce ceiling and must-haves in riskClassifier` — Kayla
5. `feat(execute): run approved high-risk actions on the demo-store origin; in-page order confirmation` — third member
6. `polish: failure-state copy, real-site fixes, tested sites` — Lumi's author
7. `feat(negotiate): scripted seller chat in demo store` — third member; `feat(negotiate): proposeOffer tool and REQUEST_OFFER with deterministic refusal` — Kayla; `feat(negotiate): chat read/click tab handlers and Negotiate button` — Lumi's author
8. `docs(readme): mandate, execution, built-during-hackathon, honesty notes` — third member

Each: `git status` → `git add <only this task's files>` → `git commit -m "<message>"` → `git pull --rebase origin main` → `git push`.
