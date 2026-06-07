# ADR-0003 — Bundler Module Resolution for All Internal Packages

## Context

Turborepo monorepos have two strategies for consuming internal TypeScript packages:

1. **Compile first**: each package builds to JS; consumers import the compiled output.
2. **Raw TS via transpilePackages**: consumers (Next.js) transpile the TypeScript source directly;
   no build step per package.

The choice affects the `moduleResolution` setting in tsconfig: `NodeNext` requires explicit `.js`
extensions in relative imports; `Bundler` is extension-agnostic (how bundlers actually resolve).

## Decision

All internal packages use **`moduleResolution: Bundler`** and **`module: ESNext`**. Packages export
their raw TypeScript source (e.g., `"exports": { ".": "./src/index.ts" }`). Next.js transpiles them
via `transpilePackages` in `next.config.ts`.

For packages that run as standalone Node.js scripts (seed, migrations, check-rls), `tsx` is used
as the runtime — it handles TypeScript + ESM regardless of the tsconfig `module` setting.

## Consequences

- No build step is needed for packages to be consumed by the Next.js app.
- `tsx` is the required runtime for standalone scripts; add it as a dev dep to any package with
  scripts.
- If a package is ever published externally (npm), it will need a separate build step and its
  tsconfig would switch back to `NodeNext`. Until then, Bundler is correct.
- Relative imports within packages do not need `.js` extensions.
