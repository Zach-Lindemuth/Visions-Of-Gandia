import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { auth, isLoading } = useAuth();

  // Still attempting to restore session from cookie — don't redirect yet
  if (isLoading) return null;

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
