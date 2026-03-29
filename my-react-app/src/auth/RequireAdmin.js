import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAdmin({ children }) {
  const { auth, isLoading } = useAuth();

  if (isLoading) return null;

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (auth.roleName !== "Admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
