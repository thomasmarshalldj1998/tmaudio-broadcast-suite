# ===========================================================================
#  TMAUDIO Digital Broadcast Processing Suite — Standalone Edition v1.0
#  Single self-contained executable per platform. Everything below is
#  compiled in: no plugins, no DLLs, no runtime installers, no Python/Java/
#  .NET, no dlopen, no telemetry, no background services.
#
#  Platform artifacts
#    Windows 10+ x64 : TMAUDIO.exe            (portable, /MT static CRT)
#    Linux           : TMAUDIO.AppImage       (single file, no system pkgs)
#    macOS           : TMAUDIO.app            (Universal arm64 + x86_64)
# ===========================================================================

cmake_minimum_required(VERSION 3.24)

project(TMAUDIO
        VERSION 1.0.0
        DESCRIPTION "Digital Broadcast Processing Suite - Standalone Edition"
        LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>") # /MT

# ---------------------------------------------------------------- options --
option(TMAUDIO_STANDALONE   "Single self-contained executable"        ON)
option(TMAUDIO_STATIC_RUNTIME "Static CRT / libstdc++ / libc++"       ON)
option(TMAUDIO_CODECS       "Static AAC/MP3/Ogg encoders"             ON)
option(TMAUDIO_GUI          "JUCE STANDALONE window (no plugin host)" ON)
option(TMAUDIO_TESTS        "Catch2 unit tests (never shipped)"       ON)
set(TMAUDIO_SIMD "AUTO" CACHE STRING "AVX2 | NEON | AUTO | SCALAR")

# ------------------------------------------------------------ dependencies -
# All third-party sources are vendored under third_party/ and linked
# statically. Nothing is found through the system package manager.
set(SNDFILE_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SNDFILE_BUILD_PROGRAMS OFF CACHE BOOL "" FORCE)
set(FFTW_BUILD_TESTS       OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS      OFF CACHE BOOL "" FORCE)

add_subdirectory(third_party/juce)
add_subdirectory(third_party/fftw)
add_subdirectory(third_party/libsndfile)
if(TMAUDIO_CODECS)
  add_subdirectory(third_party/lame)
  add_subdirectory(third_party/fdk-aac)
  add_subdirectory(third_party/libvorbis)
  add_subdirectory(third_party/libopus)
endif()
if(TMAUDIO_TESTS)
  add_subdirectory(third_party/Catch2)
  enable_testing()
endif()

# ------------------------------------------------------------------- SIMD ---
if(TMAUDIO_SIMD STREQUAL "AUTO")
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64|ARM64")
    set(TMAUDIO_SIMD "NEON")
  elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    set(TMAUDIO_SIMD "AVX2")
  else()
    set(TMAUDIO_SIMD "SCALAR")
  endif()
endif()

# ------------------------------------------------------------------ source --
set(TMAUDIO_CORE_SOURCES
    src/core/ProcessorGraph.cpp
    src/core/AudioBuffer.cpp
    src/core/SampleRateConverter.cpp
    src/repair/Declipper.cpp
    src/repair/Dequantiser.cpp
    src/repair/HumRejector.cpp
    src/dsp/filters/FirDesign.cpp
    src/dsp/analysis/Centroid.cpp
    src/dsp/analysis/TransientDensity.cpp
    src/dsp/analysis/SpeechDetect.cpp
    src/sensus/SensusEngine.cpp
    src/sensus/ImagingStage.cpp
    src/chains/fm/FmChain.cpp
    src/chains/fm/MpxMatrix.cpp
    src/chains/fm/LoImdClipper.cpp
    src/chains/fm/Sm1268Mask.cpp
    src/chains/dab/DabChain.cpp
    src/chains/web/WebChain.cpp
    src/chains/hd/HdChain.cpp
    src/rds/RdsEncoder.cpp
    src/io/RtpUdpSink.cpp
    src/io/IcecastSink.cpp)

add_library(tmaudio_core STATIC ${TMAUDIO_CORE_SOURCES})
target_include_directories(tmaudio_core PUBLIC src)
target_compile_definitions(tmaudio_core PUBLIC
        TMAUDIO_SIMD_${TMAUDIO_SIMD}=1
        TMAUDIO_STANDALONE=$<BOOL:${TMAUDIO_STANDALONE}>)
target_link_libraries(tmaudio_core PUBLIC
        juce::juce_audio_utils
        juce::juce_dsp
        fftw3f
        sndfile)
if(TMAUDIO_CODECS)
  target_link_libraries(tmaudio_core PUBLIC mp3lame fdk-aac vorbisenc opus)
endif()

if(TMAUDIO_SIMD STREQUAL "AVX2")
  target_compile_options(tmaudio_core PUBLIC -mavx2 -mfma /arch:AVX2)
elseif(TMAUDIO_SIMD STREQUAL "NEON")
  target_compile_options(tmaudio_core PUBLIC -mfpu=neon)
endif()

# ------------------------------------------------------------- executable ----
if(TMAUDIO_GUI)
  juce_add_gui_app(TMAUDIO
      PRODUCT_NAME "TMAUDIO"
      COMPANY_NAME "TMAUDIO"
      BUNDLE_ID    "io.tmaudio.suite"
      ICON_BIG     assets/icon.png
      NEEDS_CURL   FALSE
      NEEDS_WEB_BROWSER FALSE)

  target_sources(TMAUDIO PRIVATE
      src/app/main.cpp
      gui/MainWindow.cpp
      gui/panels/InputPanel.cpp
      gui/panels/SensusPanel.cpp
      gui/panels/ChainPanel.cpp
      gui/panels/RdsPanel.cpp
      gui/panels/MeterPanel.cpp
      gui/look/TmaLookAndFeel.cpp)

  target_link_libraries(TMAUDIO PRIVATE tmaudio_core)
  target_compile_definitions(TMAUDIO PRIVATE
      JUCE_STANDALONE_APP=1
      JUCE_PLUGINHOST_VST=0
      JUCE_PLUGINHOST_VST3=0
      JUCE_PLUGINHOST_AU=0
      JUCE_WEB_BROWSER=0
      JUCE_USE_CURL=0
      JUCE_DISPLAY_SPLASH_SCREEN=0)
else()
  add_executable(TMAUDIO src/app/main.cpp)
  target_link_libraries(TMAUDIO PRIVATE tmaudio_core)
endif()

# ------------------------------------------------------------------ tests ----
if(TMAUDIO_TESTS)
  add_executable(tmaudio_tests
         tests/Crc10Tests.cpp
         tests/MaskTests.cpp
         tests/SensusSummationTests.cpp
         tests/LoudnessTests.cpp)
  target_link_libraries(tmaudio_tests PRIVATE tmaudio_core Catch2::Catch2WithMain)
  add_test(NAME tmaudio_tests COMMAND tmaudio_tests)
endif()

# ----------------------------------------------------------- packaging ------
# Windows : pwsh  native/scripts/package-windows.ps1  -> dist/TMAUDIO.exe
# Linux   : bash  native/scripts/package-linux.sh     -> dist/TMAUDIO.AppImage
# macOS   : bash  native/scripts/package-macos.sh     -> dist/TMAUDIO.app
install(TARGETS TMAUDIO RUNTIME DESTINATION bin BUNDLE DESTINATION .)
install(DIRECTORY presets/ DESTINATION presets)
