# ORBIT · YZ Lab

Open Research on Behavior, Intelligence & Technology

Good taste, shared context, research in motion.

Private research-group workspace. Static GitHub Pages frontend with Supabase
Authentication and database-enforced authorization. Public source code is not
the research database. No file uploads: use links or offline handoffs.

## Research workbench update · 2026-10-16

Install `017_research_workbench.sql` in the existing Supabase project before
uploading this web update. Do not rerun the original setup migrations or create
a replacement database. The separately supplied UPDATE-GUIDE explains rollout,
permissions, storage, and verification. 017 does not reset existing records.

- Open a Study or Paper to see its research workbench; use **Record details**
  for names, status, membership, authors and handoff fields.
- **Next moves**: shared next steps, optional deadlines, inline edits, completed
  items folded and crossed out, removals recoverable via Undo or Removed items.
- **For discussion**: questions with context; record a decision to resolve the
  question, or create a linked next move while leaving the question open.
- **Research / Paper trail**: short findings, decisions and tried/learned notes.
- Study contribution and connection labels are shared with active lab members.
  Internal workbench entries retain their parent record's existing detail access.
- Linked Papers inherit the Study brief but keep their own entries. A Study can
  show folded references to accessible Paper next moves, without duplicating them.
- **Calendar → Block time**: one weekday, any half-hour-aligned range within
  09:00–17:00, including a full working day. Conflicts reject the whole request.

All Study members have equal workbench editing rights. For linked Papers,
Study members, the Paper owner and Faculty can edit. Other people with lab-wide
detail access are read-only. Direct/independent Paper editing stays with the
owner and Faculty. Authorship and current-holder fields do not grant access.

## Deployment

The update ZIP contains only `index.html`, `app.js`, `workbench.js`, `styles.css`
and this README. Upload the **files inside** the ZIP to the root of the existing
`swhitezyj/orbit-lab` repository. Keep `config.js`, fonts and logos unchanged.
No Node installation or build is needed for GitHub Pages. Never put passwords,
service-role keys, secret keys, SQL exports or real research data in this public
repository. The Supabase publishable key is a browser key, not an administrator key.

Students need an ORBIT login, not GitHub repository write access. Only trusted
code maintainers should be GitHub collaborators. New students still use the
existing Supabase invite/create-account and ORBIT Activate student workflow;
assign Study membership as appropriate.
