
import { Link, useLocation } from "wouter";

export function NavLinks({ items, variant = "side" }) {
  const [path] = useLocation();
  const active = (href) =>
    href === "/app" ? path === "/app" || path.startsWith("/app/results") : path.startsWith(href);

  if (variant === "bottom") {
    return (
      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-rule bg-bg lg:hidden"
      >
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active(it.href) ? "page" : undefined}
            className={`flex items-center justify-center text-[14px] transition-colors ${
              active(it.href) ? "text-ink" : "text-muted"
            }`}
          >
            <span className={active(it.href) ? "border-b-2 border-ink pb-0.5" : "pb-0.5"}>
              {it.label.replace("Check a leaf", "Check")}
            </span>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="App" className="flex flex-col px-3 pt-4">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active(it.href) ? "page" : undefined}
          className={`flex h-[34px] items-center rounded-md px-2 text-[14px] transition-colors ${
            active(it.href) ? "text-ink font-medium" : "text-muted hover:text-ink-2"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
