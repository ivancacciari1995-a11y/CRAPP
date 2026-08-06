import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, Trophy, User, Users } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/squadra", label: "Squadra", icon: Users },
  { to: "/classifica", label: "Classifica", icon: Trophy },
  { to: "/profilo", label: "Profilo", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="group flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-accent"
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}