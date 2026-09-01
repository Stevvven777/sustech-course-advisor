# Web toolchain license boundary

`sharp@0.35.2` enters this checkout only through the local Cloudflare/Miniflare development toolchain and is marked `dev: true`. Sharp itself is Apache-2.0. Its platform-specific prebuilt libvips packages are optional development dependencies whose lockfile metadata includes LGPL terms.

Those native packages are not imported by the timetable application and are not present in the Cloudflare Worker/client output under `dist/`. The repository does not publish `web/node_modules`. Therefore their presence in the development lockfile does not relicense the timetable application or require publishing the whole application under GPL/LGPL.

This boundary is enforced by `npm run license:check` after every production build. It fails if an LGPL-tagged package becomes non-optional, becomes a production dependency, appears outside the reviewed Sharp package family, or appears in deployable output.

If a future release distributes the development `node_modules` tree or embeds libvips into an artifact, this conclusion no longer applies. That release must ship the applicable LGPL license/notices and satisfy the corresponding-library/source and replacement/relinking obligations. Do not suppress the check in that case.

Primary project references:

- Sharp license and source: <https://github.com/lovell/sharp>
- Sharp/libvips packaged-library notices: <https://github.com/lovell/sharp-libvips/blob/main/THIRD-PARTY-NOTICES.md>
- libvips license: <https://github.com/libvips/libvips/blob/master/LICENSE>
