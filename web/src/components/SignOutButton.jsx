import { useLocation } from "wouter";

import { useAuth } from "@/lib/auth";

export function SignOutButton({ className = "" }) {
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        logout();
        navigate("/", { replace: true });
      }}
    >
      Sign out
    </button>
  );
}
