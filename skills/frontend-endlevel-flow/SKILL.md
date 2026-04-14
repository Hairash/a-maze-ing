# frontend-endlevel-flow

## Purpose
Use this skill when changing end-of-level UX in the maze game.

## Workflow
1. Update `src/App.vue` for state transitions (`finish -> modal -> reveal -> next level`).
2. Update `src/components/Board.vue` to render reveal-only overlays.
3. Update `src/game/engine.js` only for movement/progress persistence logic.
4. Keep rendering concerns in Vue components and storage/game-state concerns in engine.

## Verification
- Run `npm run build`.
- Manually verify there is no blocking browser `alert` in finish flow.
- Ensure overlay elements are `pointer-events: none` unless interactive by design.
