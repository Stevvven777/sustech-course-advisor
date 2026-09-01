# Runtime dependency license review

- `jszip@3.10.1` is dual-licensed `(MIT OR GPL-3.0-or-later)`; the project selects MIT and records its notice in `THIRD_PARTY_NOTICES.md`. It is not a GPL-only dependency.
- `buffers@0.1.1` omits license metadata in its old npm tarball. The release check accepts it only through the documented MIT resolution backed by the upstream declaration and Debian source record.
- `npm run license:check` fails closed for a new runtime license, a missing license, or a new GPL-family expression until it receives an explicit reviewed resolution.
- Development-only packages are checked separately when they are shipped or embedded in an artifact; they are not runtime contents of the advisor npm package.
