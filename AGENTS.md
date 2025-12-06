# Agent Guidelines for Bridget Theme

## Build & Commands

- **Build**: `pnpm run build` (runs vite:build then hugo:build)
- **Development**: `pnpm run dev` (parallel vite:dev and hugo:dev)
- **Lint**: `pnpm run lint` (eslint --fix + prettier --write)
- **Lint Check**: `pnpm run lint:check` (check without fixing)
- **Server**: `pnpm run server` (production server with hugo + vite)

## Code Style

- **TypeScript**: Strict mode enabled, ES2021 target
- **Formatting**: Prettier with 2-space tabs, 88 char width, single quotes, no semicolons
- **Imports**: Organize with prettier-plugin-organize-imports, sort-imports ESLint rule
- **Import Order**: builtin → external → internal → parent → sibling → index
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces/components
- **SolidJS**: Use JSX.Element return types, prefer createSignal/createEffect patterns
- **Error Handling**: Use tiny-invariant for assertions, proper type guards

## Project Structure

- TypeScript entry: `assets/ts/main.tsx`
- Styles: `assets/scss/` (SCSS with critical.scss separation)
- Build output: `static/bundled/` (Vite builds to this directory)
- Hugo source: `exampleSite/` (development and build context)
