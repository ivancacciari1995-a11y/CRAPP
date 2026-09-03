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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CrAPP — L'app del CRAP Volley" },
      {
        name: "description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { name: "author", content: "CRAP Volley" },
      { name: "theme-color", content: "#111111" },
      { property: "og:title", content: "CrAPP — L'app del CRAP Volley" },
      {
        property: "og:description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "CrAPP — L'app del CRAP Volley" },
      {
        name: "twitter:description",
        content:
          "Convocazioni, presenze, statistiche e classifica del CRAP Volley in un'unica app mobile.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd5ebd0b-6661-43fa-936c-35856d1068c4/id-preview-2942946e--8d07b0e4-6bd2-4a17-9dd2-bb2cf13f9f7c.lovable.app-1785491191791.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd5ebd0b-6661-43fa-936c-35856d1068c4/id-preview-2942946e--8d07b0e4-6bd2-4a17-9dd2-bb2cf13f9f7c.lovable.app-1785491191791.png",
      },
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
    <html lang="en">
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
      <div className="grid min-h-screen place-items-center bg-background">
        <TeamLogo className="h-16 w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
      {!isBenvenuto && <BottomNav />}
      {!isBenvenuto && <CelebrazioneBadge />}
      <Toaster position="top-center" duration={3500} closeButton />
    </>
  );
}
