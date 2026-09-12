# AGENTS.md

## Overview
Countdown timer app built with Vite + React.

## Setup
- Run via `docker compose -f docker-compose.base44.yml up -d --build`
- The dev server installs npm dependencies on startup and runs `vite dev` on port 3000
- Source is bind-mounted; edits hot-reload automatically

## Stack
- Vite 5 + React 18
- No backend, no database, no external secrets

## Verify
- Open `http://localhost:3000` — timer UI should render
- Set hours/minutes/seconds, click Start, verify countdown works
