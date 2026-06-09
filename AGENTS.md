# AGENTS.md

## Project

CadreOS

Repository:
J2WFFDev/CadreOS

Default branch:
main

## Read Before Changes

Read these documents before planning or implementing changes:

1. `docs/current/README.md`
2. `docs/current/roadmap.md`
3. `docs/current/arc-log.md`
4. `docs/current/open-issues.md`
5. `docs/product/CURRENT_PRODUCT_DECISIONS.md`

`docs/current/` is the current documentation source of truth unless a newer
explicit instruction says otherwise. Older files under `planning/`, including
roadmaps, may be historical and must not override `docs/current/` unless they
are explicitly updated and identified as current.

## User Role

The user acts as Systems Engineer / Product Owner / Program Manager.

The coding agent acts as implementation operator.

The user should not be required to run routine Git commands for normal development work.

## Standard Operating Model

1. Create a new branch from main.
2. Use the branch name provided in the task prompt.
3. Make only scoped changes.
4. Run validation before PR:
   - npm run typecheck
   - npm run build
   - npm test when relevant or requested
5. Commit scoped changes.
6. Push the branch.
7. Open a PR to main.
8. Report:
   - PR URL
   - branch name
   - commit hash
   - changed files
   - validation status

## Hard Rules

- Do not fabricate terminal output.
- If a command was not run, say it was not run.
- If repo state is dirty, stop and report exact changed/untracked files.
- Do not add CadreOS.code-workspace.
- Do not run npm audit fix unless explicitly approved.
- Do not upgrade npm unless explicitly approved.
- Do not change dependencies unless explicitly approved.
- Do not modify package.json or package-lock.json unless explicitly approved.
- Do not modify Prisma/schema files unless explicitly approved.
- Do not modify auth, roles, permissions, or route structure unless explicitly approved.
- Stop and report before proceeding if unexpected files are changed.

## Validation Baseline

Node:
v24.16.0

npm:
11.13.0

Baseline documentation:
docs/dev/local-agent-validation-baseline.md

Known future cleanup warnings:
- Prisma package.json config deprecation before Prisma 7
- 2 moderate npm audit vulnerabilities
- npm minor update available
- Next.js middleware file convention deprecated in favor of proxy

## Recovery

Backup branch:
backup/milestone-before-local-llm-2026-06-03

Milestone docs:
docs/milestones/

## Successful Codex Trials

- PR #330: Arc DevOps.2 - local validation baseline documentation
- PR #331: Arc DevOps.3 - small app-code change trial
