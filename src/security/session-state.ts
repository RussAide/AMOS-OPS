export interface SessionRevalidationState {
  hasToken: boolean;
  evaluationSession: boolean;
  isFetched: boolean;
  isError: boolean;
  hasVerifiedUser: boolean;
}

export function shouldInvalidateSession(
  state: SessionRevalidationState,
): boolean {
  if (!state.hasToken || state.evaluationSession || !state.isFetched)
    return false;
  return state.isError || !state.hasVerifiedUser;
}
