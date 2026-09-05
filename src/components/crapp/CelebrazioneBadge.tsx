import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVotiSocial } from "@/lib/badge-social";
import { useNotificheSmart } from "@/lib/notifiche-smart";
import { useGiocatoreCorrente } from "@/lib/user-store";
import { coriandoli, useMotoRidotto } from "@/lib/motion";

const toni: Record<string, string> = {
  badge: "ring-oro/50",
  segreto: "ring-accent/60",
  serie: "ring-accent/40",
  squadra: "ring-info/50",
  social: "ring-success/50",
};

/** Focus card celebrativa: compare una sola volta per traguardo. */
export function CelebrazioneBadge() {
  const io = useGiocatoreCorrente();
  const voti = useVotiSocial();
  const { notifica, restanti, chiudi } = useNotificheSmart(io, voti.data ?? []);
  const ridotto = useMotoRidotto();
  const chiave = notifica?.id ?? notifica?.titolo ?? null;
  const infermeria = notifica?.id === "segreto:s-infermeria";
  const ritardi = notifica?.id === "segreto:s-ritardi";

  useEffect(() => {
    if (!chiave) return;
    void coriandoli(ridotto);
  }, [chiave, ridotto]);

  if (!notifica) return null;

  return (
    <div className="anim-reveal fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-4 pb-28 backdrop-blur-sm">
      <div
        className={cn(
          "anim-pop w-full max-w-md rounded-3xl bg-card p-5 shadow-pop ring-2",
          toni[notifica.tono] ?? "ring-accent/40",
        )}
        role="status"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-grad text-3xl",
              infermeria && !ridotto && "anim-battito",
              ritardi && !ridotto && "anim-oscilla",
            )}
          >
            {notifica.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">
              {notifica.tono === "segreto" ? "Badge segreto sbloccato" : "Traguardo raggiunto"}
            </p>
            <p className="mt-0.5 font-display text-2xl leading-none">{notifica.titolo}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{notifica.testo}</p>
          </div>
          <button
            type="button"
            onClick={chiudi}
            aria-label="Chiudi"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={chiudi}
          className="mt-4 w-full rounded-2xl bg-accent-grad px-4 py-3 text-sm font-bold uppercase tracking-wide text-accent-foreground"
        >
          {restanti > 0 ? `Avanti (${restanti})` : "Grande!"}
        </button>
      </div>
    </div>
  );
}
