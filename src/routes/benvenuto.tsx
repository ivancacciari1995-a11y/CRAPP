import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { TeamLogo } from "@/components/crapp/ui-bits";
import { accediConGoogle, useSessione } from "@/lib/auth";
import {
  nomeCompleto,
  slotDi,
  slotLiberi,
  useCollegaGiocatore,
  useGiocatoriSquadra,
  type GiocatoreSquadra,
} from "@/lib/giocatori-squadra";
import { impostaGiocatore, resetGiocatore, useGiocatoreCorrente } from "@/lib/user-store";

export const Route = createFileRoute("/benvenuto")({
  head: () => ({
    meta: [
      { title: "Benvenuto — CrAPP DEVELOP" },
      {
        name: "description",
        content: "Accedi e collega il tuo profilo giocatore per iniziare.",
      },
      { property: "og:title", content: "Benvenuto — CrAPP DEVELOP" },
      {
        property: "og:description",
        content: "Accedi e collega il tuo profilo giocatore per iniziare.",
      },
    ],
  }),
  component: Benvenuto,
});

function Scheda({
  titolo,
  sottotitolo,
  onClick,
  iniziali,
}: {
  titolo: string;
  sottotitolo: string;
  onClick: () => void;
  iniziali: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg">
        {iniziali}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold leading-tight">{titolo}</p>
        <p className="text-xs text-muted-foreground">{sottotitolo}</p>
      </div>
    </button>
  );
}

function Benvenuto() {
  const navigate = useNavigate();
  const giocatore = useGiocatoreCorrente();
  const { pronta, utenteId } = useSessione();
  const { righe, daDatabase } = useGiocatoriSquadra();
  const collega = useCollegaGiocatore();
  const [inCorso, setInCorso] = useState(false);

  const mioSlot = slotDi(righe, utenteId);
  // Si entra solo da loggati e con uno slot collegato (DD-011).
  const puoEntrare = !!giocatore && !!utenteId;

  useEffect(() => {
    if (puoEntrare) navigate({ to: "/" });
  }, [puoEntrare, navigate]);

  // Chi sei lo dice lo slot collegato all'account, non quello che c'è in localStorage:
  // senza slot la scelta salvata dalla vecchia selezione libera va buttata.
  useEffect(() => {
    if (mioSlot) impostaGiocatore(mioSlot.id);
    else if (utenteId && daDatabase) resetGiocatore();
  }, [mioSlot, utenteId, daDatabase]);

  async function accedi() {
    setInCorso(true);
    try {
      await accediConGoogle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Accesso non riuscito");
      setInCorso(false);
    }
  }

  async function reclama(g: GiocatoreSquadra) {
    if (!utenteId) return;
    try {
      await collega.mutateAsync({ giocatoreId: g.id, utenteId });
      impostaGiocatore(g.id);
    } catch {
      toast.error("Profilo già collegato a un altro account. Chiedi a un amministratore.");
    }
  }

  const liberi = slotLiberi(righe);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <TeamLogo className="h-20 w-20" />
      <h1 className="mt-6 text-center font-display text-4xl uppercase leading-none">
        Benvenuto in CrAPP DEVELOP
      </h1>

      {!pronta ? null : !utenteId ? (
        <>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Accedi con il tuo account Google per collegare il profilo giocatore.
          </p>
          <button
            type="button"
            onClick={accedi}
            disabled={inCorso}
            className="premi mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-accent-grad py-3.5 text-sm font-bold uppercase text-accent-foreground shadow-pop disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> Accedi con Google
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sei entrato. Scegli il tuo nome: resterà collegato a questo account.
          </p>
          <div className="mt-8 w-full max-w-sm space-y-2">
            {liberi.map((g) => (
              <Scheda
                key={g.id}
                titolo={nomeCompleto(g)}
                sottotitolo={`#${g.numero} · ${g.ruolo}`}
                iniziali={`${g.nome[0] ?? ""}${g.cognome[0] ?? ""}`.toUpperCase()}
                onClick={() => void reclama(g)}
              />
            ))}
            {liberi.length === 0 ? (
              <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-card">
                Nessun profilo libero: chiedi a un amministratore di collegarti.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
