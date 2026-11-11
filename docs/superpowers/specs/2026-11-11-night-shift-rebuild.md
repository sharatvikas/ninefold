# Ninefold: night shift (the rebuild)

*Status: design note for the `fable-rebuild` branch, 2026-11-11. It replaces the game described in `2026-11-01-ninefold-design.md`; the curriculum from that document is unchanged.*

## What stayed

- The idea: the town is a running system, each district is one area of the job, and you fix it the way an on-call engineer does.
- All 51 tickets, as data (`src/curriculum/`): their evidence, settings, terminal files and commands, verify rules, solutions and recaps. The two tickets that used to be hand-built scenes (Sinking Ships, Wrong Address) are now ordinary specs.
- The four steps: Understand, Find the cause, Change, Verify.
- The play-tracking module and its privacy rules, untouched.
- A solved ticket is saved the moment its checks pass.

## What changed, and why

| Before | Now | Why |
|---|---|---|
| Walk an avatar round a pixel-art town to reach a counter | Pick a district on an isometric night map, or from a list | Walking was the slowest part of every ticket and the hardest on a phone. The time now goes to the investigation. |
| Trust points, +6 per ticket | Three nines per ticket; the town's uptime climbs from 90.0% towards nine nines | The score is now the thing the game is named after, and it teaches what a nine costs in downtime. |
| Town as a place to walk through | Town as the status page: lit windows for closed tickets, a beacon over open ones, the bell tower for the town's nines | Progress is visible at a glance and the map earns its space. |
| Ticket screen built as a wide game scene; phones told to turn sideways | A desk: ticket on paper, evidence on dark glass, the change as a form or terminal. Three columns on a wide screen, three tabs on a phone | Plays upright on a phone, and reads like the real work: brief, evidence, change request. |
| Recap | Postmortem: grade, before and after, why it worked, the real-tool fix as a diff, where the nines went | Same teaching content, framed as the document an engineer would write. |
| Ticket list | Runbook that fills in as you close tickets | The player leaves with notes. |
| Avatar creator | Removed | It did not teach anything, and it was a lot of screen for a first minute. |

## Look

One scene: a desk at night. Navy for the night, lamp gold for anything that matters, coral for alarms, mint for healthy, warm paper for anything a person wrote. Fraunces for display, Figtree for the interface, JetBrains Mono for anything a machine wrote. All three fonts are bundled, so the game makes no third-party requests.

## Structure

- `src/game/` holds the rules with no DOM: one ticket in play (`case.ts`), grading (`score.ts`), saves, unlocks and uptime (`progress.ts`).
- `src/town/` draws the island on a canvas.
- `src/ui/` is plain DOM: the map and board, the desk, the postmortem, the runbook and settings.
- Saves moved to `ninefold.save.v2`. A first-version save is read and converted (Trust 6 becomes three nines, 5 becomes two, anything else one) and is left in place.

## Open questions

- Whether to bring back a small amount of character (keeper portraits, a line of reaction after a fix).
- The README's old gameplay GIF and screenshots were removed with the old game and need re-recording from a real browser.
