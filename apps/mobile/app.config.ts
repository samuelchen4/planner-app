import type { ConfigContext, ExpoConfig } from 'expo/config';

// APP_VARIANT picks which app this is:
// - local ("Planner - Local"): the development build `pnpm mobile` serves. A separate app with its
//   own bundle id, so it installs next to the TestFlight/App Store app instead of replacing it.
//   Set by the `local` EAS profile and by `pnpm start`.
// - dev ("Planner - Dev"): the TestFlight build for friends. Same bundle id as the App Store app
//   (same App Store Connect record), only the name on the home screen differs.
// - unset: the App Store app, "Planner".
const variant = process.env.APP_VARIANT;

export default ({ config }: ConfigContext): ExpoConfig => {
  if (variant === 'dev') return { ...config, name: 'Planner - Dev', slug: config.slug! };
  if (variant !== 'local') return config as ExpoConfig;
  return {
    ...config,
    name: 'Planner - Local',
    slug: config.slug!,
    scheme: 'planner-local',
    ios: { ...config.ios, bundleIdentifier: 'com.samuelchen.planner.local' },
    android: { ...config.android, package: 'com.samuelchen.planner.local' },
  };
};
