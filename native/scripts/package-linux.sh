#!/usr/bin/env bash
# TMAUDIO v1.0 Standalone — Linux AppImage packaging (single file, no deps).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD="$ROOT/build/linux"
DIST="$ROOT/dist"
BIN="$BUILD/TMAUDIO"

[[ -x "$BIN" ]] || { echo "build first: cmake --build build/linux --parallel" >&2; exit 1; }

rm -rf "$DIST"
mkdir -p "$DIST/AppDir/usr/bin" "$DIST/AppDir/usr/share/presets" "$DIST/AppDir/usr/share/applications"
cp "$BIN" "$DIST/AppDir/usr/bin/TMAUDIO"
cp "$ROOT"/presets/*.tm "$DIST/AppDir/usr/share/presets/"

# No system-package dependency: refuse to package if the binary still links
# anything outside glibc / libstdc++ / libm / libpthread / libdl / librt.
if command -v ldd >/dev/null; then
  mapfile -t deps < <(ldd "$BIN" 2>/dev/null | awk '{print $1}' | grep -v '^linux-vdso' | grep -v '^ld-linux' || true)
  allowed='^(libc\.so|libm\.so|libpthread\.so|libdl\.so|librt\.so|libstdc\+\+\.so|libgcc_s\.so|linux-vdso\.so|ld-linux)'
  bad=()
  for d in "${deps[@]}"; do
    [[ -z "$d" ]] && continue
    [[ "$d" =~ $allowed ]] || bad+=("$d")
  done
  if ((${#bad[@]})); then
    echo "External runtime dependency detected: ${bad[*]}" >&2; exit 1
  fi
fi

cat > "$DIST/AppDir/TMAUDIO.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=TMAUDIO
Comment=Digital Broadcast Processing Suite - Standalone Edition
Exec=TMAUDIO
Terminal=false
Categories=AudioVideo;Audio;
EOF

cat > "$DIST/AppDir/usr/share/applications/TMAUDIO.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=TMAUDIO
Exec=TMAUDIO
Categories=AudioVideo;Audio;
EOF

cat > "$DIST/AppDir/README.txt" <<'EOF'
TMAUDIO Standalone Edition v1.0
1. chmod +x TMAUDIO.AppImage   (already set when downloaded via a file manager)
2. ./TMAUDIO.AppImage
   No FUSE? ./TMAUDIO.AppImage --appimage-extract-and-run
3. Presets: ./presets/*.tm — plain text, editable while running.
4. No system packages, no services, no telemetry. Delete to uninstall.
EOF
cp "$DIST/AppDir/README.txt" "$DIST/AppDir/usr/share/presets/../README.txt" 2>/dev/null || true

if command -v appimagetool >/dev/null; then
  appimagetool "$DIST/AppDir" "$DIST/TMAUDIO.AppImage"
else
  echo "appimagetool not found — AppDir staged at $DIST/AppDir" >&2
  exit 1
fi

chmod +x "$DIST/TMAUDIO.AppImage"
echo "OK -> $DIST/TMAUDIO.AppImage"
