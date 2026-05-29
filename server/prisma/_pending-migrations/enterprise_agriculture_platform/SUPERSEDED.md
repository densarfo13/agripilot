# SUPERSEDED — enterprise_agriculture_platform

This pending migration is **no longer active**. The
[`admin_impact_demographics`](../admin_impact_demographics/)
fragment is the canonical staging for Organization / Program /
Intervention / InterventionParticipant.

This directory is **kept for audit**. The fragment is NOT
deployable as-is.

See `../RECONCILIATION.md` for the reconciliation procedure +
which fields (if any) from this fragment need to be ported into
the canonical fragment before supervised deploy.

The CI gate `check:prisma-fragment-conflicts` skips this
directory because of the presence of this `SUPERSEDED.md`
marker.

To revert (only if the active fragment is removed and this one
becomes canonical again): delete this `SUPERSEDED.md` and
update `../RECONCILIATION.md`.
