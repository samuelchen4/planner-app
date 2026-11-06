# iOS Testing & Release Guide

How we get the Expo iOS app onto a phone and later through App Store review.
Account sign-up items are deferred until the app is further along. Doing the app work first.

## Testing on a real iPhone without review

App Review applies only to public App Store releases and external TestFlight testers. Everything else is unreviewed.

| Stage | How | Review? | Notes |
|---|---|---|---|
| 1. Expo Go | Install the Expo Go app, scan the QR code from `npx expo start` | No | Fastest start. Can't run custom native code (PowerSync's local database, App Intents, widgets), so we outgrow it quickly. |
| 2. Development build (daily driver) | `eas build --profile development`, install once, then live-reload JS from the Mac | No | Includes our native modules. Rebuild only when native code or dependencies change. |
| 3. Internal distribution | `eas build --profile preview` produces an install link | No | For friends and testers. Register each device first with `eas device:create`. Limited to about 100 iPhones per year. |
| 4. TestFlight, internal testers | `eas submit` uploads to App Store Connect, testers install through the TestFlight app | No | Closest to the real release. Up to 100 testers (App Store Connect team members). |
| 5. TestFlight, external testers | Invite up to 10,000 testers by email or public link | Light beta review | Builds expire after 90 days. |

### One-time setup
- **Apple Developer Program, $99/yr.** A free Apple ID can install to your own phone through Xcode, but those builds expire after 7 days and lack features we need (push notifications, widgets sharing data with the app).
- **Developer Mode on the iPhone:** Settings → Privacy & Security → Developer Mode.
- **Let EAS manage signing.** EAS creates and stores Apple's certificates and provisioning profiles. We should rarely need to open Xcode.

## Pipeline (app repo)

Build profiles in `eas.json`:

| Profile | Purpose | Backend |
|---|---|---|
| `development` | Dev build (`expo-dev-client`) | local / staging |
| `preview` | Internal distribution | staging |
| `production` | TestFlight and App Store, with build-number auto-increment | prod |

Day to day:
- **Native change:** `eas build --profile production --auto-submit` lands the build in TestFlight. Can be triggered from GitHub Actions on a release tag.
- **JavaScript-only fix:** `eas update --channel production`. Phones pick it up on the next launch with no review. Allowed as long as the update doesn't change what the app fundamentally is.

## App Store approval checklist

### Account and listing
- [ ] **Choose individual or organization enrollment.** Individual is quick and your personal name appears as the seller. Organization shows a company name but needs a D-U-N-S number first and takes days to weeks.
- [ ] **Bundle ID** (e.g. `com.yourname.planner`). Permanent, so choose carefully.
- [ ] **Reserve the app name** in App Store Connect early. Names must be unused on the App Store.
- [ ] **Privacy policy URL and support URL.** Required. A simple page on the web app is fine.
- [ ] **App Privacy questionnaire:** what data we collect (account email, planner content, analytics) and why.
- [ ] **Privacy manifest.** Expo produces most of it. Declare any extras in `app.json`.
- [ ] **Screenshots** for the largest iPhone size, plus a 1024px icon, description, keywords and age rating.
  - Set `supportsTablet: false` for now, or iPad screenshots and an iPad layout that works are also required.
- [ ] **Encryption question:** set `ITSAppUsesNonExemptEncryption: false` (standard HTTPS only) to skip it on every upload.

### Rules this app is most likely to hit
1. **In-app account deletion.** If users can create an account, they must be able to delete it from inside the app. This is the most common rejection for apps like ours. Build it from the start.
2. **Sign in with Apple.** If we offer Google sign-in, we must also offer a privacy-focused option, and Sign in with Apple covers it. Supabase supports it out of the box.
3. **Demo account for the reviewer.** Put working test credentials, ideally with sample data, in the review notes.
4. **Specific permission messages,** e.g. "Planner shows your Google and Apple calendar events alongside your tasks." Vague text gets rejected.
5. **No crashes, placeholders or "coming soon" screens.** Hide unfinished features instead.
6. **Payments.** Charging for features inside the app generally requires Apple's in-app purchase system, with some regional exceptions that keep changing. RevenueCat makes this easier. Not needed for v1.

### Google's approval process (separate from Apple's)
Google treats access to users' calendars as sensitive. Before the public can connect their Google Calendar, Google must verify our OAuth app: privacy policy, a demo video and domain verification. This can take a few weeks. Until then we're limited to 100 test users. **Start it as soon as the Calendar feature takes shape.**

### Timing
App Review usually takes a day or two. A first rejection is common: fix the issue, reply in App Store Connect, and resubmit.

## First steps (when ready)
1. Enroll in the Apple Developer Program (get a D-U-N-S number first if enrolling as an organization).
2. Set up Expo and EAS, and get a development build onto the phone.
3. Reserve the app name and bundle ID in App Store Connect.
4. Upload an early build to TestFlight for internal testing, to prove the pipeline works.
5. Before the first review submission: privacy policy page, account deletion, Sign in with Apple.
