# ORBIT · YZ Lab

Open Research on Behavior, Intelligence & Technology

Good taste, shared context, research in motion.

Private research-group workspace. Static GitHub Pages frontend with Supabase
Authentication and database-enforced authorization. Public source code is not
the research database. No file uploads: use links or offline handoffs.

## Study team permissions · 018 · 2026-10-16

After installing 017, run the separately supplied `018_study_leads.sql` once,
then upload this web update. Existing members and records are preserved.

- Any Study member can move that Study to an existing, unarchived Program,
  or Ungrouped, through **Record details → Research program**.
- Open a Study → **Members & leads** to view its team. Faculty and Study leads
  can add/remove ordinary members and appoint additional active student leads.
- Only Faculty can remove or demote an existing lead. Leads have no extra
  permissions outside their own Study and cannot create/edit Programs.
- Student-created Studies automatically make the creator a lead. Existing
  Studies require Faculty to assign their initial leads; there is no backfill.
- Team changes use a version check to prevent overwriting concurrent changes.
  Archived Studies and Studies under archived Programs are read-only here.
- Moving a Study does not change membership, visibility or Paper associations.
  Adding a member grants membership-based access to linked private Papers.
  Removing a member does not revoke separate Paper ownership or lab-wide access.

## Research workbench · 017

This update retains the installed 017 workbench. Do not rerun 017 or the original
setup migrations. The separately supplied UPDATE-GUIDE explains rollout,
permissions, storage, and verification. Neither update resets existing records.

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
