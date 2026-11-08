/**
 * How long a single tap waits for a second tap before it counts as a single tap (double-tap
 * toggles done; a single tap opens details). The single tap's action is delayed by this much, so
 * keep it short: lower opens details faster, but the double tap must be quicker.
 */
export const DOUBLE_TAP_MAX_DELAY_MS = 200;
