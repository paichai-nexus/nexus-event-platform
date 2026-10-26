export type StaffRole = "ADMIN" | "STAFF" | "JUDGE";

export function hasRequiredRole(
  role: string | null | undefined,
  active: boolean | null | undefined,
  allowedRoles: readonly StaffRole[],
): role is StaffRole {
  return active === true && typeof role === "string" && allowedRoles.includes(role as StaffRole);
}
