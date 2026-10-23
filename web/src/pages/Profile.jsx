import { AppShell } from "@/components/AppShell";
import { ProfileForms } from "@/components/ProfileForms";
import { SignOutButton } from "@/components/SignOutButton";
import { useAuth } from "@/lib/auth";
import { useTitle } from "@/lib/useTitle";

export function ProfilePage() {
  useTitle("Profile");
  const { user } = useAuth();
  return (
    <AppShell user={user} title="Profile" actions={<SignOutButton className="btn btn-quiet btn-sm" />}>
      <ProfileForms user={user} />
    </AppShell>
  );
}
