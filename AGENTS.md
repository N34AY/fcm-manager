## Architecture

This is a Tauri desktop app: Astro (static, client-side only, no SSR) as the
frontend in `src/`, Rust in `src-tauri/src/` as the backend. The frontend
never calls FMC directly — it only calls Rust `#[tauri::command]`s via
`invoke()` from `@tauri-apps/api`. All FMC HTTP calls and the TLS bypass
live in Rust (`src-tauri/src/fmc.rs`). The app can edit mappings on any
Dynamic Object the connected account has FMC rights to, and never deletes
Dynamic Objects.

## Development

Launch the full native app (rebuilds Rust + serves the Astro dev server
Tauri points at automatically):

```
npm run tauri dev
```

For frontend-only iteration without the native shell, `astro dev
--background` still works (manage with `astro dev stop` / `status` /
`logs`), but any `invoke()` calls will fail outside the Tauri webview since
there's no Rust backend behind it.

To type-check the frontend: `npx astro check`. To check the Rust side:
`cd src-tauri && cargo check`.

## Documentation

Astro: https://docs.astro.build
Tauri: https://v2.tauri.app/

Consult these guides before working on related tasks:

- [Astro client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/)
- [Tauri commands (Rust <-> JS IPC)](https://v2.tauri.app/develop/calling-rust/)
- [Tauri app data / path resolution](https://v2.tauri.app/plugin/path/)
- [tauri-action CI workflow](https://github.com/tauri-apps/tauri-action)
