# Upstream #4: Linux credential-store lookup

- Upstream: `wormforce/sustech-cli#4`
- Symptom: a stored login may later fail with `CREDENTIAL_STORE_ERROR` from `linux-secret-service`.
- Safety impact: repeated login attempts do not repair an unavailable or mismatched Secret Service session and may confuse authentication failure with storage failure.
- Downstream containment: environment reports installation and authentication readiness separately; diagnosis records only the backend and stable error code. No plaintext fallback is permitted.
- Maintenance rule: reproduce with a synthetic backend failure. Never collect a password, SID, keyring item, D-Bus address, or home-directory path.
- Upstream fix remains authoritative because credential storage belongs to `sustech-cli`.
