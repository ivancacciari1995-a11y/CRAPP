import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, Camera, Trash2, Bell, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, Section, StatTile } from "@/components/crapp/ui-bits";
import { Avatar } from "@/components/crapp/Avatar";
import { fileToAvatar, salvaAvatar, rimuoviAvatar, useAvatar } from "@/lib/avatar-store";
import { SerieGriglia } from "@/components/crapp/SerieCard";
import { CollezioneBadge } from "@/components/crapp/CollezioneBadge";
import { ProfiloAmministrativo } from "@/components/crapp/ProfiloAmministrativo";
import { useVotiSocial } from "@/lib/badge-social";
import { useIo } from "@/lib/rosa";
import { usePresenzeUltimoMese } from "@/lib/presenze-mese";
import {
  attivaNotifiche,
  disattivaNotifiche,
  pushSupportato,
  statoNotifiche,
} from "@/lib/push-client";
import { resetGiocatore } from "@/lib/user-store";
import { esci } from "@/lib/auth";
import { useIsAdmin } from "@/lib/ruoli";
import { Reveal } from "@/components/motion/Reveal";

export const Route = createFileRoute("/profilo")({
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
  const votiSocial = useVotiSocial();
  const g = useIo();
  const admin = useIsAdmin();
  const ultimoMese = usePresenzeUltimoMese(g?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const foto = useAvatar(g?.id);
  const [notifiche, setNotifiche] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [supportate, setSupportate] = useState(true);

  useEffect(() => {
    setSupportate(pushSupportato());
    statoNotifiche()
      .then(setNotifiche)
      .catch(() => setNotifiche(false));
  }, []);

  if (!g) return null;

  async function cambiaNotifiche() {
    if (!g || inCorso) return;
    setInCorso(true);
    try {
      if (notifiche) {
        await disattivaNotifiche();
        setNotifiche(false);
        toast.success("Notifiche disattivate");
      } else {
        await attivaNotifiche(g.id);
        setNotifiche(true);
        toast.success("Notifiche palloni attive");
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

  const percPresenze = Math.round((g.presenze / g.totaliEventi) * 100);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !g) return;
    try {
      salvaAvatar(g.id, await fileToAvatar(file));
      toast.success("Immagine profilo aggiornata");
    } catch {
      toast.error("Non sono riuscito a caricare l'immagine");
    }
  }

  return (
    <>
      <PageHeader titolo={g.nome} sottotitolo={`#${g.numero} · ${g.ruolo}`} />

      <Reveal className="-mt-6 px-5">
        <div className="premi rounded-3xl bg-card p-4 shadow-card">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar id={g.id} fallback={g.iniziali} className="h-20 w-20 text-2xl" />
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-accent-grad text-accent-foreground shadow-pop"
                aria-label="Cambia foto"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-xl bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wide"
            >
              Cambia immagine profilo
            </button>
            {foto ? (
              <button
                type="button"
                onClick={() => {
                  rimuoviAvatar(g.id);
                  toast.success("Immagine rimossa");
                }}
                className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-muted-foreground"
                aria-label="Rimuovi immagine"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </Reveal>

      <Section titolo="Stagione" indice={1}>
        <div className="grid grid-cols-3 gap-2">
          <StatTile valore={g.presenze} label="Presenze" hint={`${percPresenze}% del totale`} />
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
      </Section>

      <Section titolo="Serie di presenze" indice={2}>
        <SerieGriglia g={g} />
      </Section>

      <Section titolo="Collezione badge" indice={3}>
        <CollezioneBadge g={g} votiSocial={votiSocial.data ?? []} />
      </Section>

      <ProfiloAmministrativo giocatoreId={g.id} indice={4} />

      <Section titolo="Impostazioni">
        <div className="divide-y divide-border overflow-hidden rounded-3xl bg-card shadow-card">
          <button
            type="button"
            onClick={cambiaNotifiche}
            disabled={!supportate || inCorso}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate">Notifiche turno palloni</span>
              <span className="block text-[11px] text-muted-foreground">
                {supportate
                  ? notifiche
                    ? "Attive su questo dispositivo"
                    : "Ricevi l'avviso il giorno stesso e la volta dopo"
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
          {[
            "Notifiche convocazioni",
            "Promemoria allenamenti",
            "Cambi orario",
            "Bacheca squadra",
          ].map((v) => (
            <label key={v} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">{v}</span>
              <input type="checkbox" defaultChecked className="h-5 w-9 accent-[var(--accent)]" />
            </label>
          ))}
          {admin ? (
            <Link
              to="/admin"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/5"
            >
              <span className="min-w-0 truncate">Dashboard amministratore</span>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/5"
          >
            <span className="min-w-0 truncate">Esci</span>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </Section>
    </>
  );
}
