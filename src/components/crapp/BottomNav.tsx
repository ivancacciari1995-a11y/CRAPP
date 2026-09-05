import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, Trophy, User, Users } from "lucide-react";

const items = [
  { to: "/", label: "Oggi", icon: Home },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/squadra", label: "Squadra", icon: Users },
  { to: "/classifica", label: "Classifica", icon: Trophy },
  { to: "/profilo", label: "Profilo", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navigazione principale"
      // `materiale` + `bordo-sfumato`: la barra è un vetro sotto cui il
      // contenuto scorre, con una sfumatura al posto della riga netta.
      className="materiale bordo-sfumato fixed inset-x-0 bottom-0 z-40"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ "aria-current": "page" }}
            // Lo stato attivo non è solo colore: cambia anche il peso del
            // testo e compare la barretta sopra l'icona.
            className="group relative flex min-h-11 flex-col items-center gap-1 py-2.5 text-xs font-semibold text-muted-foreground transition-colors data-[status=active]:font-extrabold data-[status=active]:text-accent"
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent opacity-0 transition-opacity group-data-[status=active]:opacity-100"
                />
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.6 : 2.2} />
                {label}
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
