export function retainAcceptedRecoveryPassword<
  T extends { email: string; password: string },
>(current: T, acceptedPassword: string, accountName?: string): T {
  return {
    ...current,
    ...(accountName ? { email: accountName } : {}),
    password: acceptedPassword,
  };
}

export function recoveryPasswordsMatch(
  password: string,
  confirmation: string,
): boolean {
  return password.length > 0 && password === confirmation;
}
