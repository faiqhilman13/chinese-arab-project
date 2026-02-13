"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "⌂" },
  { href: "/ar", label: "العربية", icon: "ع" },
  { href: "/zh", label: "中文", icon: "中" },
] as const;

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-slate-900">Language Learning</span>
      </div>
      
      <div className="flex gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm"
              }`}
            >
              <span className="mr-1.5">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
