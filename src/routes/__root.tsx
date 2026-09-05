import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "../components/crapp/BottomNav";
import { CelebrazioneBadge } from "../components/crapp/CelebrazioneBadge";
import { Toaster } from "../components/ui/sonner";
import { TeamLogo } from "../components/crapp/ui-bits";
import { useGiocatoreBase } from "../lib/user-store";
import { useSessione } from "../lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display-lg text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="premi inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Questa pagina non si è caricata
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Qualcosa è andato storto da parte nostra. Puoi riprovare o tornare alla home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="premi inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Riprova
          </button>
          <a
            href="/"
            className="premi inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
          >
            Torna alla home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // `viewport-fit=cover` è obbligatorio perché env(safe-area-inset-*) sia
      // diverso da 0 su iOS: senza, la BottomNav finisce sotto la home bar.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "CrAPP — L'app del CRAP Volley" },
      {
        name: "description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { name: "author", content: "CRAP Volley" },
      // Deve combaciare con --background, altrimenti la barra di stato resta
      // nera sopra un'interfaccia chiara.
      { name: "theme-color", content: "#e4e8ed" },
      { property: "og:title", content: "CrAPP — L'app del CRAP Volley" },
      {
        property: "og:description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { property: "og:type", content: "website" },
      // `summary` e non `summary_large_image`: l'unica immagine è l'icona
      // quadrata della squadra, non una copertina 2:1.
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CrAPP — L'app del CRAP Volley" },
      {
        name: "twitter:description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png", sizes: "192x192" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // `AppShell` legge la rosa da `giocatori_squadra` (useGiocatoreBase → DD-015): serve stare
  // dentro il QueryClientProvider, quindi il provider avvolge tutto fin da qui.
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const giocatore = useGiocatoreBase();
  const { pronta, utenteId } = useSessione();
  const [mounted, setMounted] = useState(false);
  const isBenvenuto = location.pathname === "/benvenuto";

  // Senza sessione Google non si entra: l'identità la dà il login, non la scelta del nome
  // (DD-011). Si aspetta `pronta`, altrimenti il primo render sloggato rimbalzerebbe fuori
  // chi ha già la sessione in localStorage.
  useEffect(() => {
    setMounted(true);
    if (pronta && (!giocatore || !utenteId) && !isBenvenuto) {
      navigate({ to: "/benvenuto" });
    }
  }, [giocatore, utenteId, pronta, isBenvenuto, navigate]);

  if (!mounted || !pronta) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <TeamLogo className="h-16 w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="spazio-nav mx-auto min-h-dvh max-w-md bg-background">
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
      {!isBenvenuto && <BottomNav />}
      {!isBenvenuto && <CelebrazioneBadge />}
      <Toaster position="top-center" duration={3500} closeButton />
    </>
  );
}
