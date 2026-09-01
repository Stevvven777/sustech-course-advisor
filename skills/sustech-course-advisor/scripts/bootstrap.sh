#!/bin/sh
set -eu

NODE_VERSION=${SUSTECH_ADVISOR_NODE_VERSION:-20.18.0}
ADVISOR_VERSION=${SUSTECH_ADVISOR_VERSION:-0.2.0}
SUSTECH_VERSION=${SUSTECH_CLI_VERSION:-0.10.0}
INSTALL_ROOT=${SUSTECH_ADVISOR_INSTALL_ROOT:-"$HOME/.local/share/sustech-course-advisor"}
PACKAGE_ROOT="$INSTALL_ROOT/packages"
BIN_ROOT="$INSTALL_ROOT/bin"

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
    TEMP_ROOT=$(mktemp -d)
    trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM
    ARCHIVE="$NODE_NAME.tar.gz"
    BASE_URL="https://nodejs.org/dist/v$NODE_VERSION"
    curl -L --fail --silent --show-error "$BASE_URL/$ARCHIVE" -o "$TEMP_ROOT/$ARCHIVE"
    curl -L --fail --silent --show-error "$BASE_URL/SHASUMS256.txt" -o "$TEMP_ROOT/SHASUMS256.txt"
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

mkdir -p "$PACKAGE_ROOT" "$BIN_ROOT"
if [ -n "${NODE_HOME:-}" ]; then PATH="$NODE_HOME/bin:$PATH" "$NPM_BIN" install --prefix "$PACKAGE_ROOT" --omit=dev --no-audit --no-fund "sustech-course-advisor@$ADVISOR_VERSION" "sustech-cli@$SUSTECH_VERSION"
else "$NPM_BIN" install --prefix "$PACKAGE_ROOT" --omit=dev --no-audit --no-fund "sustech-course-advisor@$ADVISOR_VERSION" "sustech-cli@$SUSTECH_VERSION"
fi

printf '%s\n' '#!/bin/sh' "exec \"$NODE_BIN\" \"$PACKAGE_ROOT/node_modules/sustech-course-advisor/dist/cli.js\" \"\$@\"" > "$BIN_ROOT/sustech-advisor"
printf '%s\n' '#!/bin/sh' "exec \"$NODE_BIN\" \"$PACKAGE_ROOT/node_modules/sustech-cli/dist/cli.js\" \"\$@\"" > "$BIN_ROOT/sustech"
chmod 700 "$BIN_ROOT/sustech-advisor" "$BIN_ROOT/sustech"

"$BIN_ROOT/sustech" version >/dev/null
"$BIN_ROOT/sustech-advisor" help >/dev/null
printf 'Installation verified. Use these executables without changing PATH:\n%s\n%s\n' "$BIN_ROOT/sustech" "$BIN_ROOT/sustech-advisor"
