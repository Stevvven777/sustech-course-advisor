#!/bin/sh
set -eu

NODE_VERSION=${SUSTECH_ADVISOR_NODE_VERSION:-20.18.0}
ADVISOR_VERSION=${SUSTECH_ADVISOR_VERSION:-0.2.5}
SUSTECH_VERSION=${SUSTECH_CLI_VERSION:-0.10.0}
ADVISOR_REPOSITORY=${SUSTECH_ADVISOR_RELEASE_REPOSITORY:-Stevvven777/sustech-course-advisor}
ADVISOR_RELEASE_TAG=${SUSTECH_ADVISOR_RELEASE_TAG:-v$ADVISOR_VERSION}
ADVISOR_ASSET="sustech-course-advisor-$ADVISOR_VERSION.tgz"
ADVISOR_RELEASE_BASE_URL=${SUSTECH_ADVISOR_RELEASE_BASE_URL:-"https://github.com/$ADVISOR_REPOSITORY/releases/download/$ADVISOR_RELEASE_TAG"}
INSTALL_ROOT=${SUSTECH_ADVISOR_INSTALL_ROOT:-"$HOME/.local/share/sustech-course-advisor"}
mkdir -p "$INSTALL_ROOT"
INSTALL_ROOT=$(cd "$INSTALL_ROOT" && pwd -P)
PACKAGE_ROOT="$INSTALL_ROOT/packages"
BIN_ROOT="$INSTALL_ROOT/bin"
SCRIPT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)

TEMP_ROOT=$(mktemp -d)
trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM

version_ok() {
  "$1" -e "const a=process.versions.node.split('.').map(Number),b='$NODE_VERSION'.split('.').map(Number);process.exit(a.some((v,i)=>v!==(b[i]||0))?(a.find((v,i)=>v!==(b[i]||0))>(b[a.findIndex((v,i)=>v!==(b[i]||0))]||0)?0:1):0)"
}

NODE_BIN=""
NPM_BIN=""
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && version_ok "$(command -v node)"; then
  NODE_BIN=$(command -v node)
  NPM_BIN=$(command -v npm)
else
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) NODE_PLATFORM=darwin-arm64 ;;
    Darwin-x86_64) NODE_PLATFORM=darwin-x64 ;;
    Linux-aarch64|Linux-arm64) NODE_PLATFORM=linux-arm64 ;;
    Linux-x86_64) NODE_PLATFORM=linux-x64 ;;
    *) echo "Unsupported platform for isolated Node.js bootstrap." >&2; exit 1 ;;
  esac
  NODE_NAME="node-v$NODE_VERSION-$NODE_PLATFORM"
  NODE_HOME="$INSTALL_ROOT/runtime/$NODE_NAME"
  if [ ! -x "$NODE_HOME/bin/node" ]; then
    command -v curl >/dev/null 2>&1 || { echo "curl is required to download verified Node.js." >&2; exit 1; }
    command -v tar >/dev/null 2>&1 || { echo "tar is required to unpack Node.js." >&2; exit 1; }
    ARCHIVE="$NODE_NAME.tar.gz"
    BASE_URL="https://nodejs.org/dist/v$NODE_VERSION"
    curl -L --fail --silent --show-error --connect-timeout 10 --max-time 180 --retry 1 --retry-delay 1 "$BASE_URL/$ARCHIVE" -o "$TEMP_ROOT/$ARCHIVE"
    curl -L --fail --silent --show-error --connect-timeout 10 --max-time 180 --retry 1 --retry-delay 1 "$BASE_URL/SHASUMS256.txt" -o "$TEMP_ROOT/SHASUMS256.txt"
    EXPECTED=$(awk -v file="$ARCHIVE" '$2 == file { print $1 }' "$TEMP_ROOT/SHASUMS256.txt")
    [ -n "$EXPECTED" ] || { echo "Node.js checksum entry is missing." >&2; exit 1; }
    if command -v shasum >/dev/null 2>&1; then ACTUAL=$(shasum -a 256 "$TEMP_ROOT/$ARCHIVE" | awk '{print $1}')
    elif command -v sha256sum >/dev/null 2>&1; then ACTUAL=$(sha256sum "$TEMP_ROOT/$ARCHIVE" | awk '{print $1}')
    else echo "A SHA-256 verifier is required." >&2; exit 1
    fi
    [ "$ACTUAL" = "$EXPECTED" ] || { echo "Node.js checksum verification failed." >&2; exit 1; }
    mkdir -p "$INSTALL_ROOT/runtime"
    tar -xzf "$TEMP_ROOT/$ARCHIVE" -C "$INSTALL_ROOT/runtime"
  fi
  NODE_BIN="$NODE_HOME/bin/node"
  NPM_BIN="$NODE_HOME/bin/npm"
fi

run_npm() {
  if [ -n "${NODE_HOME:-}" ]; then PATH="$NODE_HOME/bin:$PATH" "$NPM_BIN" "$@"
  else "$NPM_BIN" "$@"
  fi
}

mkdir -p "$PACKAGE_ROOT" "$BIN_ROOT"
command -v curl >/dev/null 2>&1 || { echo "curl is required to download the advisor GitHub Release." >&2; exit 1; }
curl -L --fail --silent --show-error --connect-timeout 10 --max-time 180 --retry 1 --retry-delay 1 "$ADVISOR_RELEASE_BASE_URL/$ADVISOR_ASSET" -o "$TEMP_ROOT/$ADVISOR_ASSET"
curl -L --fail --silent --show-error --connect-timeout 10 --max-time 180 --retry 1 --retry-delay 1 "$ADVISOR_RELEASE_BASE_URL/$ADVISOR_ASSET.sha256" -o "$TEMP_ROOT/$ADVISOR_ASSET.sha256"
EXPECTED=$(awk -v file="$ADVISOR_ASSET" '$2 == file { print $1; exit }' "$TEMP_ROOT/$ADVISOR_ASSET.sha256")
[ -n "$EXPECTED" ] || { echo "Advisor checksum entry is missing." >&2; exit 1; }
if command -v shasum >/dev/null 2>&1; then ACTUAL=$(shasum -a 256 "$TEMP_ROOT/$ADVISOR_ASSET" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then ACTUAL=$(sha256sum "$TEMP_ROOT/$ADVISOR_ASSET" | awk '{print $1}')
else echo "A SHA-256 verifier is required." >&2; exit 1
fi
[ "$ACTUAL" = "$EXPECTED" ] || { echo "Advisor GitHub Release checksum verification failed." >&2; exit 1; }
run_npm view "sustech-cli@$SUSTECH_VERSION" version --json --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000 >/dev/null || { echo "sustech-cli@$SUSTECH_VERSION is not available from the selected npm registry." >&2; exit 1; }
"$NODE_BIN" "$SCRIPT_ROOT/install-policy.mjs" prepare "$PACKAGE_ROOT" "$TEMP_ROOT/$ADVISOR_ASSET" "$ADVISOR_ASSET" "$SUSTECH_VERSION" || { echo "Could not establish the isolated runtime dependency policy." >&2; exit 1; }
(
  cd "$PACKAGE_ROOT"
  run_npm install --omit=dev --no-audit --no-fund --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000
  "$NODE_BIN" "$SCRIPT_ROOT/install-policy.mjs" verify "$PACKAGE_ROOT" "$ADVISOR_VERSION" "$SUSTECH_VERSION" || { echo "Installed packages do not satisfy the audited version and provenance policy." >&2; exit 1; }
  run_npm audit --omit=dev --audit-level=low --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000 >/dev/null || { echo "Installed runtime dependency audit failed." >&2; exit 1; }
)

printf '%s\n' '#!/bin/sh' "exec \"$NODE_BIN\" \"$PACKAGE_ROOT/node_modules/sustech-course-advisor/dist/cli.js\" \"\$@\"" > "$BIN_ROOT/sustech-advisor"
printf '%s\n' '#!/bin/sh' "exec \"$NODE_BIN\" \"$PACKAGE_ROOT/node_modules/sustech-cli/dist/cli.js\" \"\$@\"" > "$BIN_ROOT/sustech"
chmod 700 "$BIN_ROOT/sustech-advisor" "$BIN_ROOT/sustech"

"$BIN_ROOT/sustech" version >/dev/null
"$BIN_ROOT/sustech-advisor" help >/dev/null
DOCTOR_REPORT=$(SUSTECH_BIN="$BIN_ROOT/sustech" "$BIN_ROOT/sustech-advisor" doctor 2>/dev/null || true)
printf '%s' "$DOCTOR_REPORT" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const r=JSON.parse(s);if(r.installationReady!==true)process.exit(1)}catch{process.exit(1)}})' || { echo "Installed commands do not satisfy the advisor capability contract." >&2; exit 1; }
printf 'Installation verified. Use these executables without changing PATH:\n%s\n%s\n' "$BIN_ROOT/sustech" "$BIN_ROOT/sustech-advisor"
