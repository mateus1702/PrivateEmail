# Design system (Project5 frontend)

## Source of truth

1. **Runtime styling:** [`theme.css`](./theme.css) — CSS custom properties (`--color-*`, `--spacing-*`, `--radius-*`, etc.). Loaded first in [`main.tsx`](../main.tsx).
2. **TypeScript mirrors:** [`tokens/`](./tokens/) — same semantics for tooling, documentation, and future codegen. Keep names aligned with `theme.css` comments.

## Usage

- **Components:** Prefer `var(--token)` in CSS Modules via primitives in `src/components/ui/`.
- **Do not** duplicate hex values for semantic roles; extend `theme.css` and document in `tokens/colors.ts` when adding a new role.

## Themes

- Default: dark (`:root` / `[data-theme="dark"]`).
- Light: set `data-theme="light"` on `html` or `body` when you add a theme toggle.
