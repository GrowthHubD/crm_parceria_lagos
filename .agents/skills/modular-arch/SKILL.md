---
name: modular-arch
description: Enforce strict Feature-Sliced Design / Module-Scoped architecture for all frontend code generation. Prevents polluting global folders.
---

# Modular Architecture Guide (Feature-Sliced Design)

You must ALWAYS follow these architectural rules when creating new components, hooks, or logic for this project.

## 1. The Golden Rule: No God Folders
DO NOT place domain-specific or feature-specific code in global directories conventions without explicit permission.
- ❌ BAD: `frontend/src/components/GameList.tsx`
- ❌ BAD: `frontend/src/hooks/useGames.ts`
- ✅ GOOD: `frontend/src/modules/games/components/GameList.tsx`
- ✅ GOOD: `frontend/src/modules/games/hooks/useGames.ts`

## 2. Global vs. Module-Scoped
- **Global (`frontend/src/components/ui/`)**: ONLY for truly agnostic, highly reusable UI primitives (e.g., `Button.tsx`, `Modal.tsx`, `Spinner.tsx`, `Badge.tsx`, `Card.tsx`). They must have zero business logic and zero knowledge of domain entities like "games" or "categories".
- **Module-Scoped (`frontend/src/modules/<feature-name>/`)**: For everything else. If a component renders a Game, fetches Categories, or manages a User, it belongs inside its respective module folder.

## 3. Module Internal Structure
When creating a new feature module (e.g., `src/modules/auth`), use the following internal structure (create folders as needed):
- `components/`: UI specific to this feature.
- `hooks/`: Custom React hooks for this feature's state/logic.
- `types/`: TypeScript interfaces specific to this domain.
- `services/` or `api/`: Data fetching and API calls for this domain.
- `utils/`: Helper functions uniquely used by this feature.

## 4. Execution Directives for LLMs
Whenever the user asks you to "create a new component", "build a new page", or "add a new feature":
1. First, determine the core domain/feature it belongs to.
2. If it's a domain-specific feature, ALWAYS navigate to or create the `frontend/src/modules/[domain]/` directory.
3. NEVER place domain logic in `frontend/src/components/` naturally.
4. Refactor legacy code into this structure when making deep modifications.
