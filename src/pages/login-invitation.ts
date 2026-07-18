export function invitationTokenFromLocation(
  search: string,
  hash: string,
): string | null {
  const queryToken = new URLSearchParams(search).get("invite");
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const fragmentToken = new URLSearchParams(fragment).get("invite");
  return queryToken ?? fragmentToken;
}
