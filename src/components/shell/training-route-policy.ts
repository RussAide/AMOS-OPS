const TRAINING_ROUTE_PATTERNS = [
  /^\/onboarding$/,
  /^\/onboarding\/training$/,
  /^\/onboarding\/track\/universal-orientation$/,
  /^\/onboarding\/module\/mod-10[1-9]$/,
  /^\/onboarding\/module\/mod-11[0-6]$/,
] as const;

export function isTrainingRouteAllowed(pathname: string): boolean {
  return TRAINING_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
