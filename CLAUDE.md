# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Audiogata plugin for Google Drive integration that allows storing and retrieving audiogata data (playlists, plugins, now playing) on Google Drive. The plugin is built as a dual-entry system:
- A main plugin entry (`src/index.ts`) that handles Google Drive API interactions
- An options page (`src/App.tsx`) built with SolidJS for user interface

## Build Commands

```bash
# Build both the options page and plugin
npm run build

# Build only the options page (SolidJS UI)
npm run build:options

# Build only the plugin entry point
npm run build:plugin
```

## Architecture

### Dual Build System
The project uses two separate Vite configurations:
- `vite.config.ts`: Builds the SolidJS options page (`src/options.html` → `dist/options.html`)
- `plugin.vite.config.ts`: Builds the main plugin script (`src/index.ts` → `dist/index.js`)

### Key Components
- **Main Plugin** (`src/index.ts`): Handles Google Drive API operations, OAuth token management, and file operations
- **Options UI** (`src/App.tsx`): SolidJS-based interface for login, configuration, and data management
- **Message System**: Communication between plugin and UI via `UiMessageType` and `MessageType` interfaces
- **Token Management**: OAuth2 flow with refresh token handling and optional custom client credentials

### Google Drive Integration
- Creates and manages an "audiogata" folder in Google Drive
- Stores three types of files: `playlists.json`, `plugins.json`, `nowplaying.json`
- Uses Google Drive v2 API with resumable upload for file operations
- Implements automatic token refresh on 401 responses

### Technology Stack
- **Framework**: SolidJS for UI, TypeScript throughout
- **Styling**: TailwindCSS with custom UI components
- **HTTP Client**: ky for API requests
- **Build**: Vite with single-file plugin for bundling
- **Types**: Uses `@infogata/audiogata-plugin-typings` for plugin interface types

### Key Files
- `src/shared.ts`: Contains OAuth client configuration and token server URLs
- `src/types.ts`: TypeScript interfaces for message passing and API responses
- `manifest.json`: Plugin manifest defining entry points and metadata