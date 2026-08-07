import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TeamLogo } from "@/components/crapp/ui-bits";
import { giocatori } from "@/lib/crapp-data";
import { impostaGiocatore, useGiocatoreCorrente } from "@/lib/user-store";

export const Route = createFileRoute("/benvenuto")({
  head: () => ({
    meta: [
      { title: "Benvenuto — CrAPP" },
      {
        name: "description",
        content: "Seleziona il tuo profilo giocatore per iniziare.",
      },
      { property: "og:title", content: "Benvenuto — CrAPP" },
      {
        property: "og:description",
        content: "Seleziona il tuo profilo giocatore per iniziare.",
      },
    ],
  }),
  component: Benvenuto,
});

function Benvenuto() {
  const navigate = useNavigate();
  const giocatore = useGiocatoreCorrente();

  useEffect(() => {
    if (giocatore) {
      navigate({ to: "/" });
    }
  }, [giocatore, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <TeamLogo className="h-20 w-20" />
      <h1 className="mt-6 text-center font-display text-4xl uppercase leading-none">
        Benvenuto in CrAPP TEST
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Seleziona chi sei per personalizzare l'app.
      </p>
      <div className="mt-8 w-full max-w-sm space-y-2">
        {giocatori.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => impostaGiocatore(g.id)}
            className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 shadow-card transition-transform active:scale-[0.98]"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg">
              {g.iniziali}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold leading-tight">{g.nome}</p>
              <p className="text-xs text-muted-foreground">
                #{g.numero} · {g.ruolo}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
