# Current Documentation Source of Truth

`docs/current/` is the current CadreOS documentation source of truth unless a
newer explicit instruction says otherwise. It summarizes current direction and
links to detailed source documents without replacing planning history.

## Read First

1. [`roadmap.md`](./roadmap.md) - current build state, sequencing, and deferred work.
2. [`arc-log.md`](./arc-log.md) - concise arc completion and active-work record.
3. [`open-issues.md`](./open-issues.md) - explicitly documented unresolved issues.
4. [`decisions.md`](./decisions.md) - current product, naming, visibility, and taxonomy decisions.
5. [`known-issue-patterns.md`](./known-issue-patterns.md) - recurring implementation and validation risks.
6. [`../product/CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md) - canonical active product decisions.

## File Purposes

- `roadmap.md`: the current high-level implementation roadmap.
- `arc-log.md`: the shortest reliable answer to "what has completed and what is active?"
- `open-issues.md`: confirmed gaps and deferred decisions found in repository docs.
- `known-issue-patterns.md`: recurring categories to check during planning and review.
- `decisions.md`: consolidated current decisions with links to their source documents.

## Historical And Reference Material

- `planning/` contains detailed phase, arc, validation, and historical roadmap material.
- `planning/README.md` remains the broad planning index, but its status table may lag.
- `planning/ROADMAP.md` is the historical Phase 7A recenter roadmap.
- Other `planning/*ROADMAP*.md` files record roadmap decisions made at particular
  milestones and are reference material unless promoted here.
- `docs/future/` contains future-only roadmap placeholders, not current commitments.
- `docs/planning/` contains newer focused design/audit artifacts. These are useful
  evidence, but a recommended next slice is not automatically the active roadmap.

When documents conflict, use `docs/current/`, then
`docs/product/CURRENT_PRODUCT_DECISIONS.md`, then the newest explicit task or
product-owner decision. Mark unresolved conflicts as **needs product-owner
confirmation** rather than guessing.
