export function getRoleHomePath(role) {
  if (role === "admin") return "/admin";
  return "/user";
}
