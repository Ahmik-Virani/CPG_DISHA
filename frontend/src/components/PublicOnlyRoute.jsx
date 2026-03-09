import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleHomePath } from "../auth/roleHome";

export default function PublicOnlyRoute({ children }) {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
}
