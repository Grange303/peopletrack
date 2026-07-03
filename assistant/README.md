# Your AI personal assistant

Two pieces work together:

## 1. Weekly check-in (scheduled Claude session)

A Claude Code routine runs **every Monday morning (07:00 UTC ≈ 8am Irish time)**.
Each run starts a fresh session in your Claude environment that:

1. Reads [`goals.md`](goals.md) and [`deadlines.md`](deadlines.md) from this folder.
2. Reviews progress on your business and personal goals and asks about stalled ones.
3. Flags any deadline whose lead-time window has opened (audits, onboarding, etc.).
4. Suggests the week's top 3 priorities and sends you the summary (push + email).

**To make it smarter, keep the two files up to date** — reply to a check-in
session and ask it to update the files for you, or edit them directly on GitHub.
You can change the schedule or pause the routine from the Claude Code routines UI.

## 2. In-app Assistant tab (PeopleTrack)

Managers get an **✨ Assistant** tab inside PeopleTrack — a chat assistant
(powered by the Claude API, model `claude-opus-4-8`) that sees a live snapshot
of your data: pick rates vs targets, contract/SOP compliance per employee,
document status, and onboarding submissions (PINs, usernames and private notes
are excluded). Ask it things like "who needs attention this week?" or "what's
outstanding before our next audit?".

It uses the same `ANTHROPIC_API_KEY` Vercel environment variable as the
translation feature, so no extra setup is needed — deploy and it works.
