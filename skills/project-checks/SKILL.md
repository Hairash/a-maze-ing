# project-checks

## Purpose
Consistent local validation before commit for this Vue/Vite repository.

## Commands
1. `npm run build`
2. `git status --short`
3. `git diff -- src/App.vue src/components/Board.vue src/game/engine.js`

## Notes
- If UI changed, capture screenshot when browser tooling is available.
- Include any environment limitation in final report with a warning symbol.
