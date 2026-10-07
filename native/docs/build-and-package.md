# TMAUDIO v1.0 STANDALONE EDITION — static build

One executable per platform. Every library, codec and runtime component is
compiled in. Nothing is loaded from outside the executable at run time.

```bash
# ===========================================================================
# native/CMakeLists.txt (key options)
# ===========================================================================
option(TMAUDIO_STANDALONE   "Single self-contained executable"  ON)
option(TMAUDIO_STATIC_RUNTIME "Static CRT / libstdc++ / libc++" ON)
option(TMAUDIO_SIMD "AVX2 | NEON | AUTO | SCALAR"              "AUTO")
option(TMAUDIO_CODECS "Static AAC/MP3/Ogg encoders"            ON)
option(TMAUDIO_GUI "JUCE STANDALONE window"                    ON)

# Dependencies (all vendored into third_party/, statically linked)
#   JUCE 8         — STANDALONE app target only (no VST/AU/AAX wrapper)
#   FFTW3f         — single precision FFT, built -DENABLE_SHARED=OFF
#   libsndfile     — static .a / .lib for test-vector I/O
#   LAME, libopus, libvorbis, fdk-aac — encoders, static, no dlopen
#   Catch2 3       — unit tests only, never shipped
#
# Linux  : sudo apt install cmake ninja-build nasm \
#                  libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev
# macOS  : brew install cmake ninja nasm
# Windows: vcpkg install (nothing at runtime) — toolchain = MSVC 19.3x

# ---- Windows 10+ (portable x64 .exe, /MT, no VC redist required) ----------
cmake -S native -B build/win -G "Visual Studio 17 2022" -A x64 \
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/win --config Release --parallel
pwsh native/scripts/package-windows.ps1      # -> dist/TMAUDIO.exe

# ---- Linux (AppImage, no system packages, no install) ---------------------
cmake -S native -B build/linux -G Ninja -DCMAKE_BUILD_TYPE=Release \
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/linux --parallel
ctest --test-dir build/linux --output-on-failure
bash native/scripts/package-linux.sh          # -> dist/TMAUDIO.AppImage

# ---- macOS (Universal .app: arm64 + x86_64, drag-and-drop) ----------------
cmake -S native -B build/mac -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
      -DTMAUDIO_STANDALONE=ON -DTMAUDIO_STATIC_RUNTIME=ON
cmake --build build/mac --parallel
bash native/scripts/package-macos.sh          # -> dist/TMAUDIO.app
```

## Verification gate before a build is called v1.0

* `dumpbin /dependents`, `ldd` and `otool -L` show no third-party runtime
  libraries — the packaging scripts fail the build if they do.
* The whole `dist/` folder copies to a USB stick and runs on a clean VM with
  no development tools installed.
* Presets load from the folder beside the executable.
* `ctest` passes: CRC-10 vectors, SM.1268 conformance, band summation
  integrity, EBU R128 reference files.
