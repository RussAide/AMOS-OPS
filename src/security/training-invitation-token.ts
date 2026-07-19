export interface InvitationLocation {
  hash: string;
  pathname: string;
}

export function captureTrainingInvitationToken(
  location: InvitationLocation,
  replaceLocation: (pathname: string) => void,
): string | null {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = fragment.get("invite");
  if (!token) return null;

  replaceLocation(location.pathname);
  return token;
}
