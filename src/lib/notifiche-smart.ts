import { useCallback, useEffect, useState } from "react";
import type { Giocatore } from "./crapp-data";
import { microcopyObiettivo, progressoObiettivo, type ObiettivoSquadra } from "./obiettivi";
import { badgeGiocatore, badgeSegretiSbloccati, gradoMeta, prossimoTraguardo } from "./badges";
import { serieGiocatore } from "./serie";
import { badgeSocialVinti, categorieSocial, type VotoSocial } from "./badge-social";

export type TonoNotifica = "badge" | "segreto" | "serie" | "squadra" | "social";

export type NotificaSmart = {
  id: string;
  tono: TonoNotifica;
  emoji: string;
  titolo: string;
  testo: string;
};

/** Genera SOLO notifiche che hanno un valore reale: niente rumore. */
export function calcolaNotifiche(
  g: Giocatore,
  votiSocial: VotoSocial[] = [],
  obiettivi: ObiettivoSquadra[] = [],
): NotificaSmart[] {
  const out: NotificaSmart[] = [];

  // 1. Badge appena sbloccati
  for (const b of badgeGiocatore(g)) {
    if (!b.grado) continue;
    out.push({
      id: `badge:${b.def.id}:${b.grado}`,
      tono: "badge",
      emoji: "🏅",
      titolo: `${b.def.nome} ${gradoMeta[b.grado].label}`,
      testo: `${b.valore} ${b.def.unita}: badge sbloccato, complimenti!`,
    });
  }

  // 2. Badge segreti
  for (const b of badgeSegretiSbloccati(g)) {
    out.push({
      id: `segreto:${b.def.id}`,
      tono: "segreto",
      emoji: b.def.emoji ?? "🔓",
      titolo: `Badge segreto: ${b.def.nome}`,
      testo: b.def.notificaPush ?? b.def.celebrazione ?? "Hai scoperto un badge nascosto!",
    });
  }

  // 3. A un passo dal completamento
  const vicino = prossimoTraguardo(g);
  if (vicino && vicino.prossimaSoglia && vicino.prossimaSoglia - vicino.valore <= 2) {
    out.push({
      id: `quasi:${vicino.def.id}:${vicino.prossimaSoglia}`,
      tono: "badge",
      emoji: "🔥",
      titolo: "Sei a un passo",
      testo: `${vicino.prossimaSoglia - vicino.valore} ${vicino.def.unita} e sblocchi ${vicino.def.nome}.`,
    });
  }

  // 4. Serie importanti
  for (const s of serieGiocatore(g)) {
    if (s.def.traguardi.includes(s.valore)) {
      out.push({
        id: `serie:${s.def.tipo}:${s.valore}`,
        tono: "serie",
        emoji: "⚡",
        titolo: `Serie di ${s.valore} ${s.def.label.toLowerCase()}`,
        testo: "Continuità da veterano: non fermarti ora.",
      });
    }
  }

  // 5. Obiettivo di squadra quasi completato
  for (const o of obiettivi) {
    const pct = progressoObiettivo(o);
    if (pct >= 90 && pct < 100) {
      out.push({
        id: `obiettivo:${o.id}:90`,
        tono: "squadra",
        emoji: o.emoji,
        titolo: `${o.titolo}: ${pct}%`,
        testo: microcopyObiettivo(o),
      });
      break;
    }
  }

  // 6. Esito dei voti social
  const vinti = badgeSocialVinti(votiSocial, g.id);
  for (const cat of categorieSocial) {
    const n = vinti[cat.id];
    if (!n) continue;
    out.push({
      id: `social:${cat.id}:${n}`,
      tono: "social",
      emoji: cat.emoji,
      titolo: `${cat.nome} x${n}`,
      testo: "I tuoi compagni hanno votato per te.",
    });
  }

  return out;
}

const KEY = "crapp-notifiche-viste-v1";

function viste(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function segnaViste(ids: string[]) {
  try {
    const set = new Set([...viste(), ...ids]);
    window.localStorage.setItem(KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* storage non disponibile */
  }
}

async function notificaSistema(n: NotificaSmart) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(`${n.emoji} ${n.titolo}`, {
      body: n.testo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: n.id,
    });
  } catch {
    /* notifica non disponibile */
  }
}

/** Coda di notifiche mai mostrate prima, una alla volta. */
export function useNotificheSmart(g: Giocatore | null, votiSocial: VotoSocial[] = []) {
  const [coda, setCoda] = useState<NotificaSmart[]>([]);

  useEffect(() => {
    if (!g) return;
    const gia = new Set(viste());
    const nuove = calcolaNotifiche(g, votiSocial).filter((n) => !gia.has(n.id));
    if (nuove.length === 0) return;
    setCoda(nuove);
    segnaViste(nuove.map((n) => n.id));
    void notificaSistema(nuove[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, votiSocial.length]);

  const chiudi = useCallback(() => setCoda((c) => c.slice(1)), []);

  return { notifica: coda[0] ?? null, restanti: Math.max(0, coda.length - 1), chiudi };
}
