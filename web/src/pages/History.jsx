import { Link } from "wouter";

import { AppShell } from "@/components/AppShell";
import { HistoryList } from "@/components/HistoryList";
import { useAuth } from "@/lib/auth";
import { useTitle } from "@/lib/useTitle";

export function HistoryPage() {
  useTitle("History");
  const { user } = useAuth();
  return (
    <AppShell
      user={user}
      title="History"
      actions={
        <Link href="/app" className="btn btn-primary btn-sm">
          Check a leaf
        </Link>
      }
    >
      <HistoryList />
    </AppShell>
  );
}
