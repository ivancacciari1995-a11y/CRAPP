import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { TeamLogo } from "@/components/crapp/ui-bits";
import { accediConGoogle, esci, useSessione } from "@/lib/auth";
import {
  slotDi,
  slotPerEmail,
  useCollegaGiocatore,
  useGiocatoriSquadra,
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

function Benvenuto() {
  const navigate = useNavigate();
  const giocatore = useGiocatoreCorrente();
  const { pronta, utenteId, emailUtente } = useSessione();
  const { righe, daDatabase } = useGiocatoriSquadra();
  const collega = useCollegaGiocatore();
  const [inCorso, setInCorso] = useState(false);
  const [tentato, setTentato] = useState(false);

  const mioSlot = slotDi(righe, utenteId);
  const slotEmail = slotPerEmail(righe, emailUtente);
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

  // Collegamento automatico per email (DD-018): un solo tentativo, mai su dati di
  // fallback. Se fallisce o non trova corrispondenza resta lo stato d'errore, senza
  // scelta manuale di ripiego.
  useEffect(() => {
    if (!utenteId || !daDatabase || mioSlot || !slotEmail || tentato) return;
    setTentato(true);
    collega
      .mutateAsync({ giocatoreId: slotEmail.id, utenteId })
      .then(() => impostaGiocatore(slotEmail.id))
      .catch(() => toast.error("Collegamento non riuscito. Riprova o contatta un amministratore."));
  }, [utenteId, daDatabase, mioSlot, slotEmail, tentato, collega]);

  async function accedi() {
    setInCorso(true);
    try {
      await accediConGoogle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Accesso non riuscito");
      setInCorso(false);
    }
  }

  async function esciERiprova() {
    try {
      await esci();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uscita non riuscita");
    }
  }

  // Errore: email senza corrispondenza, oppure trovata ma il tentativo di collegamento
  // è fallito (slot nel frattempo reclamato da altri, o errore di rete).
  const erroreCollegamento =
    !!utenteId && daDatabase && !mioSlot && (!slotEmail || collega.isError);
  const inAttesaCollegamento = !!utenteId && !mioSlot && !erroreCollegamento;

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
      ) : erroreCollegamento ? (
        <>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Nessun profilo trovato per la tua email. Contatta un amministratore per collegare il tuo
            account.
          </p>
          <button
            type="button"
            onClick={() => void esciERiprova()}
            className="premi mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold uppercase shadow-card"
          >
            <LogOut className="h-4 w-4" /> Esci
          </button>
        </>
      ) : inAttesaCollegamento ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Ti stiamo collegando al tuo profilo...
        </p>
      ) : null}
    </div>
  );
}
