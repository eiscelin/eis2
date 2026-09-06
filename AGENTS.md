# Base44 Setup

This is a minimal static project consisting of a single `index.html` served by nginx.

## Running
```
docker compose -f docker-compose.base44.yml up -d
```
The web entry point is served on host port 3000.

## Notes
- No build step, no dependencies, no secrets required.
- `index.html` is bind-mounted into the nginx container, so edits appear on reload (call `reload_preview` after edits since there is no live-reload dev server).
