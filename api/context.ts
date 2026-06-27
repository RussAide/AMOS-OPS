import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export interface AuthedUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: AuthedUser;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
  };
}
