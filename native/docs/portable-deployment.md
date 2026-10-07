# Portable deployment — run from any folder or USB drive

```
dist/
├─ TMAUDIO.exe | TMAUDIO.AppImage | TMAUDIO.app
├─ presets/            *.tm  plain-text decimal configs (read/write)
├─ logs/               24 h compliance CSV, rolling 30 days
└─ README.txt
```

1. **Copy `dist/` anywhere** — no installer, no admin/root rights, no registry
   keys, no services, no scheduled tasks, no telemetry, and no network calls
   other than the stream destinations you configure yourself.
2. **Presets live beside the executable** and are plain text: the folder is
   the configuration root, so a USB stick is a complete station.
3. **First run creates `logs/` only.** Delete the folder and nothing else
   changes — all application state is `presets/` plus your config file.
4. **Windows:** SmartScreen may warn on an unsigned portable exe —
   *More info → Run anyway*, or sign with your own certificate
   (`signtool` step is in `native/scripts/package-windows.ps1`).
5. **Linux:** `chmod +x TMAUDIO.AppImage` (usually already set). FUSE is not
   required: `./TMAUDIO.AppImage --appimage-extract-and-run` works anywhere,
   including read-only or no-FUSE hosts.
6. **macOS:** right-click → *Open* on first launch, or
   `xattr -dr com.apple.quarantine TMAUDIO.app`. The Universal binary runs
   natively on Apple Silicon and Intel.
7. **Uninstall = delete the folder.**
