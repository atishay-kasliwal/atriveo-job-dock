# Contributing to Atriveo Dock

Thanks for helping. Bug reports, small fixes, and new features are all welcome.

## Getting set up

```bash
npm ci
npm run tauri dev
```

The app starts in **demo mode**, so you don't need a backend to work on the UI. Demo responses come from [`src/demo/demoServer.ts`](src/demo/demoServer.ts). If you add a sidecar endpoint the dock calls, add a matching route there, so demo mode keeps exercising the real code path.

## Before opening a pull request

- `npm run build` passes. It typechecks and bundles; CI runs the same command.
- `cargo check --manifest-path src-tauri/Cargo.toml` passes if you touched Rust.
- No tokens, passwords, or personal data in code, fixtures, or screenshots. Real connection details belong in the user's settings file, which the app manages, never in the repo.
- Keep pull requests focused, and describe what changed and why.

## Reporting a bug

Open an issue with your macOS version, Apple Silicon or Intel, and whether you were in demo or live mode. Include steps to reproduce and a screenshot if the UI is involved.

## Project layout

| Path | What lives there |
|---|---|
| `src/features/feed` | The feed, job cards, Create tab, Settings, scrape panel |
| `src/api` | Clients for the sidecar, job tracker, and scrape control |
| `src/config` | Connection settings (loaded at launch from the user's settings file) |
| `src/demo` | Demo mode: sample data, in-process backend, scripted tour |
| `src-tauri` | Rust shell: window, tray, global shortcut, saving to Downloads |
