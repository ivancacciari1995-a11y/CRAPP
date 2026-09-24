import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, Trash2, Bell, LogOut, ShieldCheck, Bug, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, PageHeader, StatTile, TeamLogo } from "@/components/crapp/ui-bits";
import { BarraSottosezioni } from "@/components/crapp/BarraSottosezioni";
import { Avatar } from "@/components/crapp/Avatar";
import {
  caricaAvatar,
  rimuoviAvatar,
  useAvatarEsiste,
  useImpostaAvatarEsiste,
} from "@/lib/avatar-store";
import { SerieGriglia } from "@/components/crapp/SerieCard";
import { CollezioneBadge } from "@/components/crapp/CollezioneBadge";
import { ProfiloAllenatore, ProfiloAmministrativo } from "@/components/crapp/ProfiloAmministrativo";
import { useVotiSocial } from "@/lib/badge-social";
import { inizialiDa } from "@/lib/crapp-data";
import { useIo } from "@/lib/rosa";
import { usePresenzeUltimoMese } from "@/lib/presenze-mese";
import {
  attivaNotifiche,
  disattivaNotifiche,
  pushSupportato,
  statoNotifiche,
} from "@/lib/push-client";
import { resetGiocatore, useGiocatoreBase } from "@/lib/user-store";
import {
  isAllenatore,
  nomeCompleto,
  ruoloVisibile,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";
import { esci } from "@/lib/auth";
import { useIsAdmin } from "@/lib/ruoli";
import { Reveal } from "@/components/motion/Reveal";
import { version as APP_VERSION } from "../../package.json";

const TAB_PROFILO = ["stagione", "badge", "documenti", "impostazioni"] as const;
type TabProfilo = (typeof TAB_PROFILO)[number];

function isTabProfilo(v: unknown): v is TabProfilo {
  return typeof v === "string" && (TAB_PROFILO as readonly string[]).includes(v);
}

export const Route = createFileRoute("/profilo")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabProfilo } => {
    const tab = isTabProfilo(search["tab"]) ? search["tab"] : undefined;
    return tab ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Profilo giocatore — CrAPP" },
      {
        name: "description",
        content: "Foto, ruolo, statistiche personali, badge e obiettivi del giocatore CRAP Volley.",
      },
      { property: "og:title", content: "Profilo giocatore — CrAPP" },
      {
        property: "og:description",
        content: "Statistiche personali, badge e presenze della stagione.",
      },
    ],
  }),
  component: Profilo,
});

function Profilo() {
  // L'allenatore ha un profilo ridotto: solo Docs e Opzioni, niente stagione né badge (DD-034).
  const base = useGiocatoreBase();
  if (base && isAllenatore(base)) return <ProfiloAllenatorePagina g={base} />;
  return <ProfiloGiocatore />;
}

function ProfiloGiocatore() {
  const { tab } = Route.useSearch();
  const tabIniziale = tab ?? "stagione";
  const votiSocial = useVotiSocial();
  const g = useIo();
  const ultimoMese = usePresenzeUltimoMese(g?.id);

  if (!g) return null;

  const percPresenze = g.totaliEventi ? Math.round((g.presenze / g.totaliEventi) * 100) : 0;

  return (
    <>
      {/* Sul profilo il logo torna in home al posto del link al profilo. */}
      <PageHeader titolo={g.nome} sottotitolo={`#${g.numero} · ${g.ruolo}`} azione={<LinkHome />} />

      <CardAvatar id={g.id} fallback={g.iniziali} />

      <BarraSottosezioni
        key={tabIniziale}
        defaultId={tabIniziale}
        riempiLarghezza
        voci={[
          {
            id: "stagione",
            label: "Season",
            contenuto: (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatTile
                    valore={g.presenze}
                    label="Presenze"
                    hint={`${percPresenze}% del totale`}
                  />
                  <StatTile
                    valore={`${ultimoMese.percentuale}%`}
                    label="Presenze 30gg"
                    hint={`${ultimoMese.presenti}/${ultimoMese.totali} eventi`}
                  />
                  <StatTile
                    valore={
                      <span className="inline-flex items-center gap-1">
                        <Flame className="h-5 w-5 text-accent" />
                        {g.streak}
                      </span>
                    }
                    label="Presenze di fila"
                  />
                  <StatTile valore={g.mediaVoto || "—"} label="Media voto" />
                  <StatTile valore={g.mvp} label="MVP" />
                  <StatTile valore={g.palloni} label="Turni palloni" />
                </div>
                <SerieGriglia g={g} />
              </div>
            ),
          },
          {
            id: "badge",
            label: "Badge",
            contenuto: <CollezioneBadge g={g} votiSocial={votiSocial.data ?? []} />,
          },
          {
            id: "documenti",
            label: "Docs",
            contenuto: <ProfiloAmministrativo giocatoreId={g.id} conTendina={false} />,
          },
          {
            id: "impostazioni",
            label: "Opzioni",
            contenuto: <TabOpzioni giocatoreId={g.id} />,
          },
        ]}
      />
    </>
  );
}

function ProfiloAllenatorePagina({ g }: { g: GiocatoreSquadra }) {
  const { tab } = Route.useSearch();
  // Stagione e Badge non esistono per l'allenatore: un link diretto apre Docs.
  const tabIniziale = tab === "impostazioni" ? "impostazioni" : "documenti";
  const nome = nomeCompleto(g);

  return (
    <>
      <PageHeader titolo={nome} sottotitolo={ruoloVisibile(g)} azione={<LinkHome />} />

      <CardAvatar id={g.id} fallback={inizialiDa(nome)} />

      <BarraSottosezioni
        key={tabIniziale}
        defaultId={tabIniziale}
        riempiLarghezza
        voci={[
          { id: "documenti", label: "Docs", contenuto: <ProfiloAllenatore g={g} /> },
          {
            id: "impostazioni",
            label: "Opzioni",
            contenuto: <TabOpzioni giocatoreId={g.id} />,
          },
        ]}
      />
    </>
  );
}

function LinkHome() {
  return (
    <Link to="/" aria-label="Vai alla home" className="premi shrink-0 rounded-2xl">
      <TeamLogo src="/logo-nerorosso.svg" className="h-14 w-14" />
    </Link>
  );
}

/** Foto profilo: stessa per giocatore e allenatore (bucket `avatar-giocatori`). */
function CardAvatar({ id, fallback }: { id: string; fallback: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fotoEsiste = useAvatarEsiste(id);
  const impostaAvatarEsiste = useImpostaAvatarEsiste();
  const [bust, setBust] = useState(0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await caricaAvatar(id, file);
      setBust(Date.now());
      impostaAvatarEsiste(id, true);
      toast.success("Immagine profilo aggiornata");
    } catch {
      toast.error("Non sono riuscito a caricare l'immagine");
    }
  }

  return (
    <Reveal className="-mt-6 px-5">
      <Card>
        <div className="flex flex-col items-center gap-4">
          <Avatar id={id} fallback={fallback} className="h-20 w-20 text-2xl" bust={bust} />
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="premi min-h-11 flex-1 rounded-xl bg-secondary px-3 text-xs font-bold uppercase tracking-wide"
          >
            Cambia immagine profilo
          </button>
          {fotoEsiste.data ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Rimuovere l'immagine profilo?")) return;
                try {
                  await rimuoviAvatar(id);
                  setBust(Date.now());
                  impostaAvatarEsiste(id, false);
                  toast.success("Immagine rimossa");
                } catch {
                  toast.error("Non sono riuscito a rimuovere l'immagine");
                }
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive"
              aria-label="Rimuovi immagine"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </Card>
    </Reveal>
  );
}

/** Tab Opzioni: notifiche, dashboard admin, segnalazioni, uscita. Uguale per tutti. */
function TabOpzioni({ giocatoreId }: { giocatoreId: string }) {
  const admin = useIsAdmin();
  const [notifiche, setNotifiche] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [supportate, setSupportate] = useState(true);

  useEffect(() => {
    setSupportate(pushSupportato());
    statoNotifiche()
      .then(setNotifiche)
      .catch(() => setNotifiche(false));
  }, []);

  async function cambiaNotifiche() {
    if (inCorso) return;
    setInCorso(true);
    try {
      if (notifiche) {
        await disattivaNotifiche();
        setNotifiche(false);
        toast.success("Notifiche disattivate");
      } else {
        await attivaNotifiche(giocatoreId);
        setNotifiche(true);
        toast.success("Notifiche attive");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifiche non disponibili");
    } finally {
      setInCorso(false);
    }
  }

  async function logout() {
    try {
      await esci();
      resetGiocatore();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uscita non riuscita");
    }
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border overflow-hidden rounded-3xl bg-card shadow-card">
        <button
          type="button"
          onClick={cambiaNotifiche}
          disabled={!supportate || inCorso}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block truncate">Notifiche</span>
            <span className="block text-xs text-muted-foreground">
              {supportate
                ? notifiche
                  ? "Attive su questo dispositivo"
                  : "Palloni, solleciti presenze e avvisi in app"
                : "Non supportate su questo dispositivo"}
            </span>
          </span>
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
              notifiche
                ? "bg-accent-grad text-accent-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            <Bell className="h-4 w-4" />
          </span>
        </button>
        {admin ? (
          <Link
            to="/admin"
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/5"
          >
            <span className="min-w-0 truncate">Dashboard amministratore</span>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </Link>
        ) : null}
        <a
          href="https://github.com/ivancacciari1995-a11y/CRAPP/issues/new?template=bug_report.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/5"
        >
          <span className="min-w-0 truncate">Segnala un bug</span>
          <Bug className="h-4 w-4 text-muted-foreground" />
        </a>
        <a
          href="https://github.com/ivancacciari1995-a11y/CRAPP/issues/new?template=feature_request.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/5"
        >
          <span className="min-w-0 truncate">Suggerisci una nuova funzionalità</span>
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
        </a>
      </div>
      <p className="text-center text-xs text-muted-foreground">CrAPP v{APP_VERSION}</p>
      <button
        type="button"
        onClick={logout}
        className="premi flex min-h-11 w-full items-center justify-center gap-2 rounded-3xl bg-destructive/15 px-4 py-3 text-sm font-bold text-destructive shadow-card"
      >
        <LogOut className="h-4 w-4" />
        Esci
      </button>
    </div>
  );
}
