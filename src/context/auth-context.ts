/**
 * Compatibility facade for older imports.
 * Authentication state and the canonical 36-role registry have a single source of truth.
 */
export { AuthProvider, useAuth } from "@/hooks/use-auth";
export type { UserRole, RoleDef, Permissions } from "@/constants/roles";
export {
  ROLE_DEFINITIONS,
  PERMISSION_MATRIX,
  ROLE_NAV_VISIBILITY,
  getRoleDef,
  getPermissions,
  getNavVisibility,
  isAdmin,
  canManageUsers,
} from "@/constants/roles";
