# fcm-manager

Desktop app (Tauri) to list, create, and delete Cisco FMC **Dynamic Objects**
and manage their IP mappings.

## Why a desktop app, not a web page

Some FMC instances present a certificate that fails normal TLS validation,
and their API sends no CORS headers — so a plain web page cannot call it
directly (browsers block both cross-origin reads without CORS and, in some
setups, the cert itself), and a page can't be told to ignore either
restriction from client-side JS.

All FMC calls happen in the app's **Rust backend** (`src-tauri/src/fmc.rs`),
not the webview:
- `reqwest` is configured with `danger_accept_invalid_certs(true)`, scoped
  only to the FMC connection.
- Since it's a native HTTP client, not a browser `fetch()`, there's no CORS
  enforcement to work around at all.

The frontend (Astro, static, in `src/`) never talks to FMC directly — it
calls Rust `#[tauri::command]`s over Tauri's IPC (`invoke(...)`), which is
not a network request and isn't subject to any of the above.

## Safety: only touches objects it created

Every dynamic object created through this app is recorded in a local JSON
file in the OS app-data directory (`app_data_dir()/managed-objects.json` —
resolved by Tauri per-platform, not inside the repo). The Rust commands for
delete / add-mapping / remove-mapping check that file **before** calling
FMC — objects that already existed before this app touched them are
read-only in the UI and rejected server-side (in Rust) even if called
directly.

## Setup

```sh
npm install
npm run tauri dev
```

This launches the native window. On first run, go to **Settings** and
either:
- paste a token copied from DevTools (`X-auth-access-token` request header
  after logging into the FMC web UI), or
- enter username/password once to fetch a fresh token via
  `POST /api/fmc_platform/v1/auth/generatetoken` (password is sent directly
  from Rust to FMC, never stored).

The domain is auto-filled from `GET /api/fmc_platform/v1/info/domain` if the
token can only see one domain; otherwise you'll get a dropdown to pick from
instead of typing a UUID.

The token lives only in the Rust process's memory — not written to disk,
lost on app restart (FMC tokens are short-lived session tokens anyway).

## Building

```sh
npm run tauri build
```

Produces a native installer for your current platform in
`src-tauri/target/release/bundle/`.

## CI builds

`.github/workflows/build.yml` builds installers for macOS (arm64 + x86_64),
Linux, and Windows on every push to `main`, and attaches them to a GitHub
Release via [tauri-action](https://github.com/tauri-apps/tauri-action).
