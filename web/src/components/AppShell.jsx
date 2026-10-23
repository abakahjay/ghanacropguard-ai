import { Link } from "wouter";

import { NavLinks } from "./NavLinks";
import { Wordmark } from "./Mark";
import { SignOutButton } from "./SignOutButton";
import { BuiltBy } from "./SiteNav";

/*
  Ruled T-frame shell (true-black-flat style): a 224px sidebar and a 64px top bar on one ground,
  divided by 1px rules. Active nav = label brightens; no coloured pills.
  Grid arithmetic (desktop): 224 sidebar + 1 rule + 29 gutter + content + 29 gutter = viewport.
*/
export function AppShell({ user, title, actions, children }) {
  const items = [
    { href: "/app", label: "Check a leaf" },
    { href: "/app/history", label: "History" },
    { href: "/crops", label: "Crop guide" },
    { href: "/app/profile", label: "Profile" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[224px_1fr]">
      <aside className="hidden border-r border-rule lg:flex lg:min-h-svh lg:flex-col">
        <div className="flex h-16 items-center border-b border-rule px-5">
          <Link href="/" aria-label="GhanaCropGuard AI home">
            <Wordmark />
          </Link>
        </div>
        <NavLinks items={items} />
        <div className="mt-auto border-t border-rule px-5 py-4 text-[14px]">
          <p className="truncate text-ink">{user.full_name || user.email}</p>
          <p className="truncate text-muted">{user.region ? `${user.region} Region` : user.email}</p>
          <SignOutButton className="mt-3 text-ink-2 hover:text-ink" />
          <Link href="/download" className="mt-2 block text-ink-2 hover:text-ink">
            Get the mobile app
          </Link>
          <BuiltBy className="mt-4 block text-[12px] text-muted" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-rule px-4 lg:h-16 lg:px-[29px]">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="lg:hidden" aria-label="Home">
              <Wordmark className="[&>span:last-child]:hidden" />
            </Link>
            <h1 className="truncate text-[18px] font-medium lg:text-[22px]">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-[29px] lg:py-8">{children}</main>
      </div>

      {/* phone: bottom bar of destinations */}
      <NavLinks items={items.slice(0, 4)} variant="bottom" />
    </div>
  );
}
