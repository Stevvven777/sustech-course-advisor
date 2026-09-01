# Upstream #6: uncertain enrollment mutations

- Upstream: `wormforce/sustech-cli#6`
- Symptom: a timed-out mutation may have been accepted, while immediate readback can lag.
- Safety impact: automatic retry can repeat a consequential action.
- Downstream containment: the advisor remains preview-only and never invokes an apply command. A failed or uncertain preview stops; it is not retried as a mutation.
- Maintenance rule: do not add enrollment retries or infer remote state from a client timeout. Reconciliation and idempotency belong upstream.
