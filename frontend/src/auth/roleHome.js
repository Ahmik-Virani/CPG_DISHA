export function getRoleHomePath(role) {
  if (role === "system_admin") return "/system-admin";
  if (role === "admin") return "/admin";
  if (role === "merchant") return "/merchant";
  return "/user";
}
