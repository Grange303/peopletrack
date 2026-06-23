# peopletrack

Workforce management for seasonal / agricultural teams — worker records, SOPs &
contracts with e-signatures, multilingual onboarding, pick-rate tracking, and an
**Audits** module to ease the burden of assurance & ethical audits.

## Audits module

Managers get an **Audits** tab to track readiness for assurance schemes. The
first scheme is **Sedex / SMETA** (4-pillar), structured so further schemes
(Red Tractor, LEAF Marque, Irish Organic Association) can be added as templates
in `AUDIT_SCHEMES` (`src/App.jsx`).

For each audit you can:

- Work through a per-scheme requirement checklist grouped by pillar/section.
- Set each item's status (Not started → In progress → Ready → N/A).
- Attach evidence (links or notes) and add notes for the auditor.
- **Export an audit pack** — a multi-sheet spreadsheet (summary, checklist with
  evidence, and a worker-evidence sheet) to hand to the auditor.

Items tagged **Auto** verify themselves live from existing PeopleTrack data:

| Requirement | Source |
| --- | --- |
| Written terms of employment issued and signed | Signed contracts |
| Worker induction & training records / H&S training | SOP reviews |
| Worker records & right-to-work documentation | Onboarding submissions |

### Setup

The module persists to a new Supabase table. Run [`supabase/audits.sql`](supabase/audits.sql)
once in the Supabase SQL editor before using the Audits tab.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
```
