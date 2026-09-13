# Pre-record checklist

Run through this once before the first take and again after any rebuild. The video window
is 14:15–14:50; nothing here should be discovered on camera.

## Build

- [ ] `npm run build` is green. `tsc --noEmit` runs first, so a red build means a type error, not a bundling one.
- [ ] **Reload the unpacked extension** at `chrome://extensions` after every build. Chrome keeps serving the previous build of an unpacked extension until you reload it, and a stale one fails with `Failed to fetch dynamically imported module …/assets/index.tsx-<hash>.js`.
- [ ] The branch you are recording is the one that runs at 14:15. Never one merged after.
- [ ] `demo-safe` tag is the fallback build. If the branch misbehaves on camera: `git checkout demo-safe && npm run build`, reload the extension, and record the reduced scenario (no negotiation — the refusal happens at checkout instead).

## Demo store

- [ ] `npm run dev` — serves the store at **http://localhost:5173/demo/index.html**.
- [ ] Record on **5173, not another port**. `executeHighRiskOrigins` defaults to `http://localhost:5173`; on any other origin the order is correctly *gated*, and the activity row reads `Applied · recorded` instead of `Applied · executed`.
- [ ] Never open `demo/index.html` from disk (`file://`). The extension overlay cannot run there; the page redirects to the dev server, which is not something you want happening on camera.
- [ ] If you edited a `<script>` tag in `demo/index.html`, **restart vite**. The crxjs dev plugin strips inline scripts and caches the page's script list at server start, so a reload alone will not pick up a new one.
- [ ] The purchase form no longer calls `alert()` — a browser dialog blocks the extension and ends the take. If you see one, you are on an old build.

## Tabs

- [ ] Exactly two tabs on the demo store (5173): one showing the laptop grid, one scrolled so the **seller chat is fully in view** with the composer and Send button visible without scrolling mid-take.
- [ ] The seller chat shows only its opening message. If it already has a negotiation in it, reload that tab — the scripted seller resets to the RM4,299 opener, counters once at RM4,150, then RM3,950 final.
- [ ] If you are recording the §5 opening beat (hover + Alt+click on a real listing site), that tab goes first, left of both demo tabs.

## Extension state

- [ ] **API key set** in Options. Without it Lumi cannot reason and the compare/negotiate beats fail.
- [ ] Keep the key on the clipboard. The 1:44 beat removes it to show the no-key state, and you will want it back for the next take.
- [ ] **Reset demo state** in Options — clears Lumi Memory, comparisons, the action log, any pending preview, the mission and the last negotiation outcome, and settles Lumi to idle. Your key, model and site settings survive it. The panel must start empty; a leftover memory item or a stale mission is the most common reason a take has to be redone.
- [ ] Mission is empty, so the Mission panel offers page-derived suggestions rather than a set mission.
- [ ] Lumi is visible on the demo store. If you clicked the × on the mascot in an earlier take, Lumi is hidden on that origin — Reset demo state brings it back everywhere, or click the toolbar icon to un-hide just the current origin.
- [ ] `localhost` is not in Options → Paused sites. That list is a separate, permanent setting; an origin on it gets no mascot at all.

## Window and OS

- [ ] Browser window **1920×1080**, and keep it that size for every take so cuts match.
- [ ] **Lumi's toolbar icon pinned** — the side panel is opened from it on camera.
- [ ] **Notifications off** (macOS: Focus → Do Not Disturb). One banner mid-take costs a retake.
- [ ] Bookmarks bar hidden, no other browser UI that names files or branches.
- [ ] Screen recorder set to the window, not the whole desktop.

## Last look

- [ ] Run the scenario once, end to end, without recording. If anything needs explaining while it happens, fix it or cut it.
- [ ] Check the activity row after the order: it must read **`Applied · executed`**. `recorded` means you are on the wrong origin — see the port note above.
