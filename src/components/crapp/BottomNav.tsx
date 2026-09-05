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
      // Barra flottante: il contenitore esterno tiene solo la posizione e
      // l'inset di sistema, il materiale sta sulla pillola dentro.
      // `pointer-events-none` perché ai lati della pillola i tocchi devono
      // arrivare al contenuto sotto.
      className="pad-sicura-fondo pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
    >
      {/*
        Altezza fissa dal token, non dedotta dal contenuto: la striscia
        toccabile misura uguale su iOS e Android, e sotto varia solo l'inset
        di sistema. Prima l'altezza dipendeva dai padding delle voci e nessuno
        poteva saperla da fuori.
      */}
      <div className="materiale pointer-events-auto mx-auto grid h-[var(--altezza-nav)] max-w-md grid-cols-5 overflow-hidden rounded-full border border-border/60 px-1 shadow-lg">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ "aria-current": "page" }}
            // Lo stato attivo non è solo colore: cambia anche il peso del
            // testo e compare la barretta sopra l'icona.
            className="group relative flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground transition-colors data-[status=active]:font-extrabold data-[status=active]:text-accent"
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
