# Upstream #5: lecture/lab bundles and identifiers

- Upstream: `wormforce/sustech-cli#5`
- Symptom: lecture and lab rows may repeat course credits and expose opaque identifiers without declaring the selectable bundle or operation-specific role.
- Safety impact: a planner could double-count credit, omit a required component, or preview the wrong target.
- Downstream containment: credits are recomputed once per normalized course code; duplicate course rows, section handles, or opaque IDs fail audit; preview requires one non-empty unique ID per selected course and stops when semantics remain ambiguous.
- Maintenance rule: do not infer bundle membership from string similarity or fabricate an identifier mapping. Use synthetic fixtures until upstream exposes an explicit contract.
