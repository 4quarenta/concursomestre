# Macrostep 20F - Implementation blueprint status

## Status

`MACRO20F_BLUEPRINT = PROVISIONAL`
`MACRO20F_IMPLEMENTATION_PLAN = NOT_READY`
`MACRO20F_IMPLEMENTATION = NOT_STARTED`

This is not a product-design blueprint disguised as a final audit. The function-level evidence required to produce one is incomplete, so a final implementation plan would be speculative.

## Reuse decisions supported by current evidence

| Capability | Classification | Evidence |
| --- | --- | --- |
| Typed Admin route authority | EXISTING_GOOD | One typed navigation source now produces the audit inventory. |
| Backend Admin RBAC | EXISTING_GOOD | Staff remains denied at the backend; shared shell was narrowed. |
| Auth session lifecycle | EXISTING_REFINE | Refresh rotation is retained; route checks now use a revocable stable session anchor. |
| Admin sitemap status | EXISTING_REFINE | Canonical read-only PHP projection replaces a missing client target. |
| General Admin page/function map | EVIDENCE_REQUIRED | Full authenticated function inventory is still absent. |
| Finance / Stripe TEST admin workflow | EVIDENCE_REQUIRED | Requires isolated provider-backed execution. |
| Campaign, segmentation, automation, and landing workflow | EVIDENCE_REQUIRED | Do not build a new domain before auditing what currently exists. |
| Mobile Admin UX | EVIDENCE_REQUIRED | Representative mobile routes and editors remain untested. |

## Required next evidence before a final blueprint

1. Build the per-function inventory from all 45 canonical Admin routes and nine standalone editors.
2. Execute safe happy-path, validation, RBAC, persistence, audit-trail, and cleanup checks for each meaningful function.
3. Use only controlled synthetic records for destructive or financial actions and Stripe TEST for provider workflows.
4. Repeat desktop and mobile visual smoke for high-risk workflows.
5. Score each function with the documented readiness formula and write a concrete improvement plan for every non-KEEP decision.
6. Only then classify each future Macro20F capability as reuse, refinement, major rework, merge, removal, or new capability.

## Guardrails preserved

- PRELAUNCH remains active.
- No real dataset insertion is authorized.
- No Stripe LIVE mutation is authorized.
- No product redesign or new campaign/segmentation engine is authorized from the present evidence.
