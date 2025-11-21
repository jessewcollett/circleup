export type OnboardingSeen = {
  version: number;
  completedAt: number;
  skipped?: boolean;
};

const LOCAL_KEY_PREFIX = 'circleup_onboarding_seen';

function buildKey(uid?: string | null): string {
  // If logged-in, scope by uid; otherwise use 'guest'
  const scope = uid || 'guest';
  return `${LOCAL_KEY_PREFIX}_${scope}`;
}

export function getOnboardingSeen(uid?: string | null): OnboardingSeen | null {
  try {
    const raw = localStorage.getItem(buildKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingSeen;
  } catch {
    return null;
  }
}

export function setOnboardingSeen(
  uid: string | null | undefined,
  payload: OnboardingSeen
): void {
  try {
    localStorage.setItem(buildKey(uid), JSON.stringify(payload));
  } catch {}
}

export function clearOnboardingSeen(uid?: string | null) {
  try {
    localStorage.removeItem(buildKey(uid));
  } catch {}
}
