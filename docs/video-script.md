# Lumi World — 2-minute demo video script

Recording window: **14:15–14:50**. Feature freeze is 14:15 — record with the branch that runs at 14:15, never with something merged after. The `demo-safe` tag is the fallback build.

## Before you hit record

- [ ] `npm run build` green on the branch you are recording.
- [ ] Extension loaded unpacked from `dist/`, API key pasted in ⚙ Options.
- [ ] `npm run dev` running; `http://localhost:5173/demo/index.html` open in tab 2.
- [ ] A real listing page open in tab 1 — one from the [Tested sites](../README.md#tested-sites) table, not a page we built.
- [ ] State reset (the demo page's reset button clears memory, mission, log, seller chat and hidden origins). See also [pre-record.md](pre-record.md).
- [ ] Notifications and other windows closed. No browser alerts anywhere in the path — an alert freezes the extension.
- [ ] A second spare copy of the API key on the clipboard, for the 1:44 beat.

## Beats

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Title / Lumi idling at the edge of a page | "Chatbots make you describe what's already on your screen." |
| 0:10 | **Real site**, tab 1. Hover a product card — Lumi turns to look, card outlines. `Alt`+click. | "You point. Lumi looks — and remembers." |
| 0:22 | Switch to the demo store. Hover a second laptop, `Alt`+click. Side panel: both objects in Lumi Memory, different tabs. | "Across tabs. It's one memory." |
| 0:32 | Mission panel: type *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."* Save → **mandate chips appear** (must-have · ceiling · walk-away). | "One sentence. That's the goal — and the limit." |
| 0:42 | Compare panel: select both → **Which fits my mission better?** Lumi goes purple, structured comparison renders, winner card. | "Not a chat reply. A structured comparison." |
| 0:48 | *(alternative to 0:22–0:42, if you want the autonomous version)* **Run my mission**: Lumi outlines each card in turn, refuses the RM4,399 MacBook out loud, scores and compares the rest. | "Or it does the whole thing itself." |
| 0:55 | Under the winner: **Negotiate this one**. Lumi sends its own opening offer into the seller's chat box — no click from you. | "It negotiates in the page's own chat box. By itself." |
| 1:02 | Seller replies **"RM4,150 is the lowest I can do"**. | — (let it land) |
| **1:06** | **Lumi refuses in the chat and counters: "I can do RM3,900. RM4,150 is above my limit of RM4,000."** Amber. Activity log row: **Refused**. | "Above the mandate. It says so, in the conversation. That decision is arithmetic in code — not the model's opinion." |
| 1:10 | Seller: **"RM3,950, final"**. Lumi **stops and asks**: *"RM3,950 works. Approve and I'll close it."* **Approve**. | "Inside the limit — and this is the one click in the whole negotiation. It asks where the money is." |
| 1:18 | Checkout form: **Fill form from memory** at RM3,950. Ghost values appear. **Hover the password and card fields — untouched.** **Apply**. | "Preview first. The password and card fields it will not read or fill — structurally." |
| 1:30 | **Place order** → red modal → tick the checkbox → **Approve** → order confirmation block appears. Log: **Applied · executed**. | "Every consequential step, approved by you." |
| 1:44 | ⚙ Options: delete the API key. Back to a page, hover something: *"I can't reason without a key, but I still remember."* | "And it fails honestly." |
| 1:50 | Lumi idling, close card | "Chatbots make you bring context to AI. Lumi brings AI to the context — and it knows when to say no." |

## If something breaks mid-take

- **Negotiation doesn't run**: drop beats 0:55–1:10. Keep the refusal at **checkout** instead — fill the form with the MacBook Air (RM4,399) as the only memory and let `checkMandate` refuse there. The refusal beat is the one thing the video cannot lose.
- **A model call errors on camera**: leave it in if the bubble reads clearly — a visible, specific failure state scores on *thoughtful failure handling*. Don't leave a spinner hanging.
- **The extension stops responding**: something triggered a browser dialog. Dismiss it manually and restart the take.

## Hard constraints

- Under 2:00. Ship at 1:55 rather than trimming live.
- Show the **refusal in the chat**, the **single approval at agreement**, the **untouched password/card fields**, and the **executed order** — one each, on camera. Those are the rubric.
- Don't narrate the architecture. Show the loop; the README carries the engineering.
