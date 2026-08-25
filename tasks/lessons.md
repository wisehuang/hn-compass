# Lessons

- Use pnpm as the project package manager. Keep `npm run …` scripts compatible for the required operator commands, but install and lock dependencies with pnpm.
- When a UI library name is not uniquely resolvable from the repository or npm registry, request its official URL before selecting or installing a package.
- For text-selection fixes, verify the browser's computed `user-select` value on the affected rendered content; programmatic selection alone can bypass CSS restrictions.
- For operator SQL intended for web consoles, provide individually executable statements first; console preview modes may append `LIMIT` and reject transaction or data-modifying CTE scripts.
