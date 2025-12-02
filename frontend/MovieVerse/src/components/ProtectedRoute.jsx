import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  // Not logged in → redirect to home and trigger modal once
  if (!user) {
    return <Navigate to="/" state={{ openAuth: true }} replace />;
  }

  // Role restriction
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="text-white text-center pt-40">
        Access Denied
      </div>
    );
  }

  return children;
}
