// @ts-check
import { defineConfig } from 'astro/config';

// Static build only — all FMC calls happen in the Tauri (Rust) backend via
// invoke(), not from the webview, so no Node SSR/adapter is needed here.
// https://astro.build/config
export default defineConfig({});
