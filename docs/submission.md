# Submission pack — Lumi World

AI Tinkerers · **"Agents, Everywhere"** · Kuala Lumpur · 13 September 2026
Team: **AstraGirls**

**Deadlines:** feature freeze 14:15 · video 14:15–14:50 · **submit by 15:20** (portal closes 15:30 — confirm with an organizer).

## Checklist

- [ ] Title (below)
- [ ] Written description (below)
- [ ] Public GitHub repo — `main` builds green, no API key in history, GLB removed
- [ ] 2-minute demo video — see [video-script.md](video-script.md)
- [ ] Social post tagging the partners (draft below — **fill in the real handles from the portal**)
- [ ] [Tested sites](../README.md#tested-sites) table filled in with pages we actually ran
- [ ] [Built during the hackathon](../README.md#built-during-the-hackathon) regenerated from the final `git log`

---

## Title

**Lumi World — the agent that points, remembers, negotiates, and says no.**

Shorter variant if the field is tight: **Lumi World — an agent with a mandate.**

## Written description

Lumi World is a Chrome extension that turns human attention into an agent's input.

Every AI assistant today sits in a chatbox and asks you to describe what is already on your screen. You stop what you are doing, open another tab, retype or paste the thing you were looking at, read an answer, then go back and do the work yourself. The information was already in front of you; the assistant just couldn't see it.

Lumi is a small 3D companion that lives at the edge of every page. You **point** — hover a product card, a listing, a row — and Lumi turns to look at it; `Alt`+click and it remembers it. Those remembered objects persist **across tabs and sessions**, so "the one from the other tab" is something the agent can actually reason about. You then give it a goal in one plain sentence, and it compares, fills, negotiates and buys inside the page — showing you what it intends to do before it does it.

The part we built at this hackathon is the **mandate**. The same sentence that states your goal states your limits: *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."* A forced OpenAI tool call parses that into a structure; from then on, whether a limit is met is decided by **arithmetic in code**, never by the model. When a seller counters above the ceiling, Lumi refuses — out loud, with the numbers, logged as a first-class `Refused` status — and walks away or falls back to the next-best option in its memory. When the price comes back inside the mandate, it negotiates, fills the checkout, and places the order for real on our demo store origin. Password and card fields are excluded structurally, by one guard function used by every path, and high-risk actions execute only on an origin allowlist and are gated everywhere else.

Technically: Manifest V3 (service worker + content script + side panel), React 18 and TypeScript, a procedural React Three Fiber mascot whose animation *is* the agent's state machine, `chrome.storage` as the single source of truth with `chrome.runtime` used only as RPC, and OpenAI Chat Completions with **forced tool calling plus zod validation** — the model can only ever return structured arguments, never prose and never code. Page content and chat transcripts reach the model as explicitly untrusted data, which makes prompt injection structurally inert: the worst a hostile page can do is produce a bad score.

What none of this can be reproduced by in a chatbox: pointing as an input modality, memory that spans tabs, an agent negotiating in the page's own chat box, and a limit you set once that the agent then holds against a counterparty who is pushing it. An agent that can say no is more useful than one that can only say yes.

*Honest scope:* the seller in our demo store is a scripted widget and there is no order backend — see the [Honesty](../README.md#honesty) section of the README. The OpenAI calls, the DOM writes, the clicks and the refusals are all real.

## Social post draft

> **⚠ Replace the bracketed handles with the real partner handles from the submission portal before posting. Do not guess them.**

**X / Twitter (≤280 chars):**

> We built Lumi World at #AITinkerers "Agents, Everywhere" 🇲🇾
>
> You don't describe your screen to it — you point. It remembers across tabs, negotiates in the page's own chat box, and when the seller goes above your ceiling it *refuses*.
>
> An agent that can say no. 🧵👇
>
> @[AITinkerers] @[partner] @[partner]

**LinkedIn:**

> **Lumi World — the agent that points, remembers, negotiates, and says no.**
>
> Built today at AI Tinkerers "Agents, Everywhere" in Kuala Lumpur with team AstraGirls.
>
> Every assistant asks you to describe what's already on your screen. Lumi watches where your attention is instead: hover something, Alt+click, and it's remembered — across tabs, across sessions. Then you give it one sentence: *"ML laptop, 16 GB RAM, ceiling RM4,000, walk away above it."*
>
> That sentence is a **mandate**, not a prompt. The model parses it; code enforces it. When the seller counters RM4,150, Lumi says: *"That's above my mandate. I'll stop before that one."* When the price comes back inside the limit, it negotiates, fills the checkout, and places the order — every consequential step behind an explicit approval, and password and card fields excluded structurally.
>
> Chrome MV3 · React · React Three Fiber · OpenAI forced tool calling + zod. Repo and 2-minute demo below.
>
> An agent that can say no is more useful than one that can only say yes.
>
> #AITinkerers #AgentsEverywhere #AI #ChromeExtension
> @[AITinkerers] @[partner] @[partner]

**Attach:** the 2-minute video, the repo link. Lead the video thumbnail on the **refusal** frame if you can pick it.
