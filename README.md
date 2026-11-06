# planner-app

Client apps for the day planner: the iOS-first mobile app now, and the browser app later.
The backend (Supabase, PowerSync rules, API, MCP server, Google Calendar worker) lives in a separate `planner-backend` repo.

## Layout

```
apps/
  mobile/          Expo (React Native) app: Expo Router, NativeWind
    src/app/       screens: every file is a route, _layout.tsx defines navigators
    src/features/  feature code (day-view/, …): components, hooks, logic
    src/lib/       app-wide helpers (theme, utils)
  web/             (later) browser app
packages/
  ui/              design tokens (tokens.js), shared Tailwind preset, shared components (Card, …)
  core/            shared data types and, later, sync/query logic
notes/             planning docs
```

## Getting started

```bash
pnpm install
pnpm mobile          # starts the Expo dev server; scan the QR code with Expo Go on your iPhone
```

Other commands:

```bash
pnpm typecheck                              # all packages
cd apps/mobile && npx expo install <pkg>    # add a native/Expo package (picks SDK-compatible versions)
cd apps/mobile && npx expo-doctor           # check dependency/config health
```

## Styling

- Tailwind class names via NativeWind (`className="rounded-card bg-card p-4"`).
- Colors, type scale and corner radius are defined once in `packages/ui/tokens.js`. Light/dark switching is automatic.
  Use semantic names: `bg-app`, `bg-card`, `text-ink`, `text-muted`, `text-accent`, `text-success`, …
- Type scale follows iOS sizes: `text-large-title`, `text-title1`…`text-title3`, `text-headline`, `text-body`, `text-subhead`, `text-footnote`, `text-caption`.
- For props that don't accept class names (SF Symbol tints, native tabs), use `useColors()` from `src/lib/theme.ts`.
- shadcn-style components: `cd apps/mobile && npx @react-native-reusables/cli@latest add <component>`.
