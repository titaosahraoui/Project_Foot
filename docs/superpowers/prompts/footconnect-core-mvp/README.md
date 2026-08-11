# FootConnect Core MVP Prompt Pack

This pack turns the approved core-MVP design into small, dependency-ordered implementation prompts. It starts from the repository as it exists on 2026-08-11 and stops when the full Algiers competitive loop is pilot-ready.

## How to use the pack

Run one task prompt at a time, in order. Use this concrete Codex instruction for the first
recommendation-scoring task, then substitute the exact milestone file and prompt ID listed in the
index for later work:

```text
Read AGENTS.md, docs/superpowers/specs/2026-08-11-footconnect-core-mvp-design.md,
docs/superpowers/prompts/footconnect-core-mvp/00-master-context.md, and
docs/superpowers/prompts/footconnect-core-mvp/06-team-availability-recommendations.md.
Execute only prompt M06-T03. Do not execute subsequent prompts.
```

The implementing agent must use test-driven development, preserve unrelated working-tree changes, run the prompt's focused verification, and commit only that prompt's files. Do not start the next prompt until the current prompt's tests and milestone dependencies pass.

## Layers

1. `00-master-context.md` supplies rules and canonical names used by every prompt.
2. Each numbered file supplies one milestone context and its micro-task prompts.
3. `docs/superpowers/plans/2026-08-11-footconnect-core-mvp-implementation.md` is the dependency and handoff index.

## Milestone order

| Milestone | Purpose                                  | Depends on      |
| --------- | ---------------------------------------- | --------------- |
| 01        | Baseline and architecture alignment      | Approved design |
| 02        | Shared domain foundation                 | 01              |
| 03        | Auth and profiles                        | 02              |
| 04        | Teams and competitive identity           | 03              |
| 05        | Pitches and owner operations             | 02, 03          |
| 06        | Team availability and recommendations    | 04, 05          |
| 07        | Challenges                               | 06              |
| 08        | Booking after agreement                  | 05, 07          |
| 09        | Match preparation                        | 04, 08          |
| 10        | Booking outcomes and reputation          | 08, 09          |
| 11        | Three-party result consensus             | 09, 10          |
| 12        | Elo, history, and leaderboards           | 04, 11          |
| 13        | Notifications and integrated experiences | 07–12           |
| 14        | Algiers pilot verification               | 01–13           |

## Gate policy

At each milestone gate:

1. Run all focused tests named by that milestone.
2. Run `pnpm typecheck`.
3. Run `pnpm lint`.
4. Run `pnpm test`.
5. When persistence changed, start infrastructure, apply the migration, and run `pnpm --filter @footconnect/api test:integration`.
6. Review `git diff --check` and confirm no unrelated files are staged.
7. Update the milestone checklist in the implementation-plan index.

Integration prerequisites:

```powershell
Copy-Item .env.example .env # only when .env does not already exist
pnpm docker:up
pnpm --filter @footconnect/api prisma:migrate
pnpm --filter @footconnect/api test:integration
```

Do not overwrite an existing `.env`.
