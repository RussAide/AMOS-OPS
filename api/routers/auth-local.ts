// Compatibility export for earlier imports. The mounted implementation is the
// hardened router in auth.ts; no independent legacy auth path remains.
export { authRouter as localAuthRouter } from "./auth";
