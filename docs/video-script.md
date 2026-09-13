# Lumi World — 2-minute demo video script

Recording window: **14:15–14:50**. Feature freeze is 14:15 — record with the branch that runs at 14:15, never with something merged after. The `demo-safe` tag is the fallback build.

The spine of this cut is **one button**. You set a mission, press *Run my mission*, and the agent does the whole loop on its own — looks at every listing, refuses what breaks your mandate, scores and compares what's left, negotiates in the seller's chat, and stops at the single moment money is committed. That is the thing a chatbox cannot do, so give it the middle minute and let it run.

## Before you hit record

Everything in [pre-record.md](pre-record.md), plus these, which are specific to this cut:

- [ ] **Do one full warm-up run and throw it away.** The autonomous segment makes 5–8 OpenAI calls; you need to know today's latency before you're recording it.
- [ ] Time the warm-up. The autonomous segment should land in **40–60 s**. If it runs past 70 s, record the [manual sequence](#fallback-the-manual-sequence) instead — it is shorter and fully under your control.
- [ ] Side panel open, **Mission panel visible**, scrolled so *Run my mission* and the mandate chips are both on screen.
- [ ] Demo store scrolled so the four laptop cards are visible; the seller chat is further down and the page will scroll itself when Lumi gets there.
- [ ] Lumi Memory empty (⚙ Options → **Reset demo state**). A leftover object changes what gets compared.
- [ ] Spare copy of the API key on the clipboard, for the closing beat.

## Beats

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Title / Lumi idling at the edge of a page | "Chatbots make you describe what's already on your screen." |
| 0:08 | **Real site**, tab 1. Hover a product card — Lumi turns to look, the card outlines. `Alt`+click. | "You point. Lumi looks — and remembers." |
| 0:18 | Switch to the demo store. Side panel: the object from the other tab is still there. | "Across tabs. One memory." |
| 0:26 | Mission panel: type *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."* Save → **mandate chips appear** (must-have · ceiling · walk-away). | "One sentence. That's the goal — and the limit." |
| **0:36** | **Press "Run my mission".** Bubble: *"Reading this page…"* then *"Looking at 4 laptops…"* | "Now I stop driving." |
| 0:42 | The outline **walks card to card** on its own. Each one is read and remembered. | — (let it move; don't talk over it) |
| **0:52** | Outline lands on the **MacBook Air, RM4,399**. Lumi turns **amber**: *"RM4,399 is above my mandate (ceiling RM4,000). I'll stop before that one."* It is **not** added to memory. | "Above the limit. It doesn't consider it, and it doesn't keep it." |
| 1:00 | Bubble: **"3 fit your limits, 1 didn't."** Then *"Scoring…"* per card, then *"Comparing the top two…"* | "That decision is arithmetic in code — not the model's opinion." |
| 1:10 | Winner outlined. Bubble: *"ASUS TUF Gaming A15 wins."* Then *"Asking the seller…"* — the page scrolls itself to the chat, which outlines amber, **LUMI · WORKING**. | "It shows you what it's about to touch, before it touches it." |
| 1:18 | Offers appear in the chat and send themselves. Seller: **"RM4,150 is the lowest I can do."** | — (let it land) |
| **1:24** | **Lumi refuses in the chat itself and counters:** *"I can do RM3,900. RM4,150 is above my limit of RM4,000."* Amber. Activity log row: **Refused**. | "It says no to the seller, not just to you — and states its own number first." |
| 1:32 | Seller: **"RM3,950, final."** Lumi **stops and asks**: *"RM3,950 works. Approve and I'll close it."* **Approve**. | "Inside the limit — and this is the one click in the whole negotiation. It asks where the money is." |
| 1:40 | Checkout form: **Fill form from memory** at RM3,950, ghost values, **password and card fields untouched** — hover them. **Apply**. | "Password and card fields it will not read or fill. Structurally." |
| 1:48 | **Place order** → red modal → tick the checkbox → **Approve** → confirmation block. Log: **Applied · executed**. | "Every consequential step, approved by you." |
| 1:56 | Lumi idling, close card | "Lumi brings AI to the context — and it knows when to say no." |

**If you are under time at 1:56**, add the honesty beat: ⚙ Options → delete the API key → hover something → *"I can't reason without a key, but I still remember."* It is the first thing to cut and the first thing to add back.

## What has to be on camera

Three frames carry the rubric. If a take loses one, do it again:

1. **The refusal** — amber, with the numbers, either at the MacBook (0:52) or in the chat (1:24). Both is better.
2. **The untouched password and card fields** during the fill (1:40).
3. **The executed order** — confirmation block plus `Applied · executed` in the log (1:48).

## Fallback: the manual sequence

Use this if *Run my mission* is cut, runs long, or fails twice in warm-up. It reaches the same three frames by hand, and every step below exists independently of the orchestrator.

| Time | Do this |
| --- | --- |
| 0:36 | `Alt`+click the **ASUS TUF A15**, then the **MacBook Air M4**, then the **Acer Swift Go** — three objects in Lumi Memory. |
| 0:50 | Compare panel: select **ASUS** and **Acer** → *Which fits my mission better?* → structured comparison, winner. |
| 1:05 | Under the winner: **Negotiate this one** → the negotiation runs exactly as in the main cut. |
| 1:32 | Same as the main cut from here: accept at RM3,950, fill, place order. |

If the negotiation itself is the thing that's broken, drop it entirely and get the refusal at **checkout** instead: clear memory, `Alt`+click **only the MacBook Air (RM4,399)**, then *Fill form from memory* — `checkMandate` refuses there, amber, logged as **Refused**. The refusal is the one beat the video cannot lose.

## Known quirks, so they don't surprise you live

- **Three cards survive, not two.** The Lenovo IdeaPad lists "16 GB DDR4", so it satisfies a `16 GB RAM` must-have. The bubble reads *"3 fit your limits, 1 didn't."* That is correct — verified against the real card text on the build being recorded.
- **If you want exactly two candidates**, lower the ceiling to **RM3,800** rather than sharpening the must-have. `RTX` or `DDR5` leaves only the ASUS, and a single survivor skips the comparison beat entirely. RM3,800 keeps the Acer and the Lenovo — but re-run the warm-up, because it changes which card wins and which one gets negotiated.
- **The run stops at anything already awaiting approval.** If a previous take left a pending preview, the button is disabled and says so. Approve or reject it, or Reset demo state.
- **Any failure stops the run once, in the bubble, with the reason** — it never retries and never loops. If you see a stalled spinner, that is not this feature.
- **Watch the side panel console** if a run goes wrong: every card logs its price, text and verdict under `[run-mission]`.

## Hard constraints

- Under 2:00. Ship at 1:56 rather than trimming live.
- Don't narrate the architecture. Show the loop; the README carries the engineering.
- No browser dialogs anywhere in the path — an `alert()` freezes the extension and ends the take.
