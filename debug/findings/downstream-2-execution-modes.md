# Downstream #2: coupled live planning and presentation

- Downstream: `Stevvven777/sustech-course-advisor#2`
- Symptom: source refresh, replanning, export, and visual verification looked like one long operation, so a presentation-only edit could appear to require TIS access and each slow campus request could consume a separate timeout.
- Safety and maintenance impact: repeated reads waste time and may encourage unsafe proxy or credential troubleshooting; implicit reuse can hide stale facts; presentation work should not require personal-data access.
- Containment: `workflow --mode live|cached|render-only` exposes three non-fallback contracts. Live reads share one total timeout budget and bounded transient-read retries. Cached planning consumes a timestamped, projected source cache and reports age. Render-only audits and exports without launching the campus CLI.
- Evidence: cross-platform tests use a nonexistent `SUSTECH_BIN` to prove cached and render-only paths do not invoke it; timeout, retry, projection, freshness, stage timing, source timestamp, and export tests use only synthetic fixtures.
- Maintenance rule: do not add implicit mode fallback. A stale cache remains usable only with a visible stale status, and a render-only path must remain free of campus reads or subprocess calls.
