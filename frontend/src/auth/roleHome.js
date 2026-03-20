export function getRoleHomePath(role) {
  if (role === "admin") return "/admin";
  else if (role === "system_head") return "/system_head/manage-event";
  return "/user";
}
