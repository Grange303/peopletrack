# peopletrack

Workforce management for seasonal / agricultural teams — worker records, SOPs &
contracts with e-signatures, multilingual onboarding, pick-rate tracking, and an
**Audits** module to ease the burden of assurance & ethical audits.

## Audits module

Managers get an **Audits** tab built on a **single unified framework** that
covers **Red Tractor, GLOBALG.A.P., LEAF Marque, Sedex/SMETA, Irish Organic
Association and seasonal-worker** audits at once. Because these schemes overlap
heavily, every
requirement is **tagged with the schemes it satisfies** — so you prepare the
evidence once and it counts toward every applicable audit ("prepare once,
comply many").

The framework lives in `UNIFIED_FRAMEWORK` and the scheme tags in
`AUDIT_SCHEME_TAGS` (`src/App.jsx`); add a scheme tag and tag the relevant
requirements to extend coverage.

For each audit you can:

- Work through one requirement checklist grouped by category (Management,
  Worker Welfare, Training, H&S, Food Safety, Crop Protection, Environment,
  Organic Integrity, Business Ethics).
- See **per-scheme readiness** at a glance and **filter** the list by scheme
  and/or category.
- Set each item's status (Not started → In progress → Ready → N/A).
- Attach evidence (links or notes) and add notes for the auditor.
- **Export an audit pack** scoped to **all schemes or a single scheme** — a
  multi-sheet spreadsheet (summary, scheme-coverage, checklist with evidence,
  and a worker-evidence sheet) to hand to the auditor.

Items tagged **Auto** verify themselves live from existing PeopleTrack data:

| Requirement | Source |
| --- | --- |
| Written terms of employment issued and signed | Signed contracts |
| Worker induction & training records / H&S training | SOP reviews |
| Worker records & right-to-work documentation | Onboarding submissions |

### Setup

The module persists to a new Supabase table. Run [`supabase/audits.sql`](supabase/audits.sql)
once in the Supabase SQL editor before using the Audits tab.

## AI Assistant

Managers get an **✨ Assistant** tab — a chat assistant with live access to
team performance, document compliance and onboarding data (via
`api/assistant.js`, using the existing `ANTHROPIC_API_KEY`). A companion
weekly check-in routine tracks goals and deadlines from the
[`assistant/`](assistant/README.md) folder.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
```
