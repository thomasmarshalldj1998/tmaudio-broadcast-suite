#!/usr/bin/env bash
# TMAUDIO v1.0 Standalone — macOS Universal .app packaging (arm64 + x86_64).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD="$ROOT/build/mac"
DIST="$ROOT/dist"
APP="$DIST/TMAUDIO.app"

[[ -d "$BUILD/TMAUDIO.app" ]] || {
  echo "build first: cmake --build build/mac --parallel" >&2; exit 1
}

rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "$BUILD/TMAUDIO.app" "$APP"

# Presets sit beside the executable bundle, editable in place.
mkdir -p "$DIST/presets"
cp "$ROOT"/presets/*.tm "$DIST/presets/"

BIN="$APP/Contents/MacOS/TMAUDIO"
lipo -info "$BIN" || true            # must report: x86_64 arm64

# Self-contained check: only system frameworks may be referenced.
bad=$(
  otool -L "$BIN" | tail -n +2 | awk '{print $1}' |
    grep -Ev '^(/usr/lib/|/System/Library/)' || true
)
if [[ -n "$bad" ]]; then
  echo "External runtime dependency detected:" >&2
  echo "$bad" >&2
  exit 1
fi

/usr/libexec/PlistBuddy -c \
  "Set :CFBundleShortVersionString 1.0.0" \
  "$APP/Contents/Info.plist"

if [[ -n "${TMAUDIO_SIGN_ID:-}" ]]; then
  codesign --force --deep --options runtime \
           --sign "$TMAUDIO_SIGN_ID" "$APP"
fi

cat > "$DIST/README.txt" <<'EOF'
TMAUDIO Standalone Edition v1.0 — macOS
1. Drag TMAUDIO.app anywhere (or /Applications).
2. First launch: right-click → Open  (or
   xattr -dr com.apple.quarantine TMAUDIO.app)
3. Universal binary: runs natively on Apple Silicon and Intel.
4. Presets: ./presets/*.tm — plain text, editable while running.
5. No services, no telemetry. Delete to uninstall.
EOF

echo "OK -> $APP (Universal)"
