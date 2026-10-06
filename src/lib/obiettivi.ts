import { giocatori, type Giocatore } from "./crapp-data";
import type { Evento } from "./eventi";
import type { MappaPresenze } from "./presenze";
import { mediaSquadra, type VotoPagella } from "./pagelle";

export type ObiettivoSquadra = {
  id: string;
  titolo: string;
  descrizione: string;
  valore: number;
  target: number;
  unita: string;
  scadenza?: string;
  emoji: string;
  /** Frase breve che spiega come ogni giocatore può spostare l'ago. */
  impatto: string;
  /** Spiegazione completa mostrata nella card di dettaglio: nessun punto oscuro. */
  dettaglio: DettaglioObiettivo;
};

export type DettaglioObiettivo = {
  /** Cosa misura l'obiettivo e come si arriva al numero mostrato, in parole semplici. */
  comeSiCalcola: string;
  /** Cosa fa salire il numero. */
  conta: string[];
  /** Cosa è una presenza persa: occupa un posto ma lo lascia vuoto, quindi abbassa la percentuale. */
  perse?: string[];
  /** Cosa resta fuori dal calcolo: non sale e non scende. */
  nonConta: string[];
  /** Quando l'obiettivo parte, quando si azzera o scade. */
  periodo: string;
  /** Da dove arrivano i dati e quando si aggiornano. */
  fonte: string;
  /** Esempio concreto con numeri. */
  esempio: string;
};

export type ContestoObiettivi = {
  eventi: Evento[];
  presenze: MappaPresenze;
  pagelle: VotoPagella[];
  /** Vittorie ufficiali in campionato (dato CSI). */
  vittorie?: number;
};

export const contestoVuoto: ContestoObiettivi = { eventi: [], presenze: {}, pagelle: [] };

/** Mese corrente in formato "YYYY-MM" (fuso Europe/Rome), per gli obiettivi che si azzerano ogni mese. */
function meseCorrente(oggi: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(oggi).slice(0, 7);
}

/** Istante corrente in Europe/Rome come "YYYY-MM-DD HH:mm", confrontabile con data + ora di un evento. */
function adessoRoma(oggi: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(oggi)
      .map((x) => [x.type, x.value]),
  );
  return `${p["year"]}-${p["month"]}-${p["day"]} ${p["hour"]}:${p["minute"]}`;
}

/** "a settembre" / "ad agosto": preposizione con elisione davanti a vocale. */
function aMese(oggi: Date): string {
  const nome = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long" }).format(
    oggi,
  );
  const preposizione = /^[aeiou]/i.test(nome) ? "ad" : "a";
  return `${preposizione} ${nome}`;
}

/** Ultimo giorno del mese corrente, come "YYYY-MM-DD". */
function fineMese(oggi: Date): string {
  const mese = meseCorrente(oggi);
  const anno = Number(mese.slice(0, 4));
  const numeroMese = Number(mese.slice(5, 7));
  const ultimoGiorno = new Date(Date.UTC(anno, numeroMese, 0)).getUTCDate();
  return `${mese}-${String(ultimoGiorno).padStart(2, "0")}`;
}

/**
 * Presenze (presente o ritardo) sul totale dei posti degli allenamenti e delle partite scelti da
 * `filtro`: per ogni evento i posti sono i convocati, o tutta la rosa se non ce ne sono. Chi non
 * è convocato non occupa un posto, quindi la sua assenza non pesa.
 */
function percentualePresenze(
  ctx: ContestoObiettivi,
  rosa: Giocatore[],
  filtro: (e: Evento) => boolean = () => true,
) {
  let posti = 0;
  let presenti = 0;
  for (const e of ctx.eventi) {
    if (e.tipo !== "partita" && e.tipo !== "allenamento") continue;
    if (!filtro(e)) continue;
    const attesi = e.convocati.length === 0 ? rosa : rosa.filter((g) => e.convocati.includes(g.id));
    posti += attesi.length;
    const risposte = ctx.presenze[e.id] ?? {};
    presenti += attesi.filter((g) => {
      const stato = risposte[g.id];
      return stato === "presente" || stato === "ritardo";
    }).length;
  }
  if (posti === 0) return 0;
  return Math.round((presenti / posti) * 100);
}

function percentualeRisposte(ctx: ContestoObiettivi, rosaSize: number) {
  const daRispondere = ctx.eventi.filter((e) => e.tipo !== "compleanno");
  if (daRispondere.length === 0 || rosaSize === 0) return 0;
  const posti = daRispondere.length * rosaSize;
  const risposte = daRispondere.reduce(
    (s, e) => s + Object.keys(ctx.presenze[e.id] ?? {}).length,
    0,
  );
  return Math.round((risposte / posti) * 100);
}

/** Obiettivi collaborativi: si muovono con il contributo di tutta la rosa. */
export function obiettiviSquadra(
  rosa: Giocatore[] = giocatori,
  ctx: ContestoObiettivi = contestoVuoto,
  oggi: Date = new Date(),
): ObiettivoSquadra[] {
  const continui = rosa.filter((g) => g.serieAllenamenti >= 3).length;
  const vittorie = ctx.vittorie ?? 0;
  const mese = meseCorrente(oggi);
  return [
    {
      id: "o1",
      titolo: `90% di presenze ${aMese(oggi)}`,
      descrizione: "Media presenze su partite e allenamenti del mese",
      valore: percentualePresenze(ctx, rosa, (e) => e.data.startsWith(mese)),
      target: 90,
      unita: "%",
      scadenza: fineMese(oggi),
      emoji: "📣",
      impatto: "Ogni sì in più alza la media di tutta la squadra.",
      dettaglio: {
        comeSiCalcola:
          "Si guardano solo le partite e gli allenamenti del mese in corso. Per ognuno i posti sono i giocatori convocati (se nessuno è stato convocato, tutta la rosa). Un posto è pieno se il giocatore ha risposto «presente» o «in ritardo», vuoto in tutti gli altri casi. La percentuale è posti pieni ÷ posti totali, sommando tutti gli eventi del mese.",
        conta: [
          "«Presente» o «in ritardo» di un convocato a una partita o a un allenamento del mese.",
          "Vale anche per gli eventi futuri del mese: appena confermi, la percentuale sale.",
        ],
        perse: [
          "«Assente» di un convocato: è una presenza persa, il posto resta vuoto.",
          "«Forse», «infortunato» o nessuna risposta di un convocato: finché non diventa «presente» o «in ritardo» il posto è vuoto.",
        ],
        nonConta: [
          "Chi non è convocato a quell'evento: non occupa un posto, quindi la sua assenza non pesa.",
          "Cene, pizzate e altri eventi di squadra, e i compleanni: non sono partite né allenamenti e restano fuori da questa statistica.",
          "Gli eventi degli altri mesi.",
        ],
        periodo:
          "Solo il mese in corso: si azzera il primo giorno di ogni mese e si chiude l'ultimo giorno del mese. Il mese dopo riparte da zero, con il suo titolo e la sua scadenza.",
        fonte:
          "Calendario (eventi e convocati) e risposte di presenza dei giocatori. Si aggiorna ogni volta che qualcuno risponde o cambia risposta.",
        esempio:
          "Ad agosto ci sono 2 allenamenti. Il primo ha 12 convocati e 10 rispondono «presente»: 10 posti pieni su 12. Il secondo ha 10 convocati e 9 «presenti»: 9 su 10. In tutto 19 posti pieni su 22, cioè 86%. I giocatori non convocati non sono nel conto: per arrivare al 90% servono almeno 20 posti pieni su 22.",
      },
    },
    {
      id: "o2",
      titolo: "Tutti rispondono alle convocazioni",
      descrizione: "Percentuale di risposte date sugli eventi in programma",
      valore: percentualeRisposte(ctx, rosa.length),
      target: 90,
      unita: "%",
      scadenza: fineMese(oggi),
      emoji: "⚡",
      impatto: "Bastano pochi tap per far quadrare i conti a chi organizza.",
      dettaglio: {
        comeSiCalcola:
          "Per ogni evento in calendario ci sono tanti posti quanti sono i giocatori in rosa. Si contano le risposte date, di qualsiasi tipo, e si divide per tutti i posti.",
        conta: [
          "Qualsiasi risposta: presente, in ritardo o assente. Conta aver risposto, non cosa si è risposto.",
          "Partite, allenamenti ed eventi di squadra.",
        ],
        nonConta: [
          "I compleanni: non richiedono risposta.",
          "Un evento a cui non hai ancora risposto.",
        ],
        periodo:
          "Considera tutti gli eventi in programma, non solo quelli del mese. La scadenza indicata è la fine del mese corrente.",
        fonte: "Eventi del calendario e risposte dei giocatori. Si aggiorna a ogni risposta.",
        esempio:
          "Con 14 giocatori e 10 eventi i posti sono 140. Con 126 risposte date, siamo al 90%.",
      },
    },
    {
      id: "o7",
      titolo: "Presenze collettive",
      descrizione: "Presenze di tutta la rosa su allenamenti e partite definiti in stagione",
      valore: percentualePresenze(ctx, rosa),
      target: 90,
      unita: "%",
      emoji: "🤝",
      impatto: "Ogni allenamento a cui vieni vale +1 per il gruppo.",
      dettaglio: {
        comeSiCalcola:
          "Si guardano tutte le partite e tutti gli allenamenti della stagione, passati e futuri. Per ognuno i posti sono i giocatori convocati (se nessuno è stato convocato, tutta la rosa). Un posto è pieno se il giocatore ha risposto «presente» o «in ritardo», vuoto in tutti gli altri casi. La percentuale è posti pieni ÷ posti totali, sommando tutti gli eventi insieme.",
        conta: [
          "«Presente» o «in ritardo» di un convocato a una partita o a un allenamento.",
          "Anche le conferme per gli eventi futuri: appena confermi, la percentuale sale.",
        ],
        perse: [
          "«Assente» di un convocato: è una presenza persa, il posto resta vuoto.",
          "«Forse», «infortunato» o nessuna risposta di un convocato: finché non diventa «presente» o «in ritardo» il posto è vuoto.",
        ],
        nonConta: [
          "Chi non è convocato a quell'evento: non occupa un posto, quindi la sua assenza non pesa.",
          "Cene, pizzate e altri eventi di squadra, e i compleanni: non sono partite né allenamenti e restano fuori da questa statistica.",
        ],
        periodo:
          "Tutta la stagione: non si azzera mai e non ha scadenza. Conta tutto ciò che c'è in calendario, quindi un evento cancellato smette di contare e uno nuovo aggiunge i suoi posti.",
        fonte:
          "Calendario (eventi e convocati) e risposte di presenza dei giocatori. Si aggiorna ogni volta che qualcuno risponde o cambia risposta.",
        esempio:
          "In stagione ci sono 3 eventi: un allenamento con 12 convocati e 10 presenti, uno con 10 convocati e 9 presenti, una partita con 14 convocati e 13 presenti. Posti pieni 32 su 36, cioè 89%: per il 90% manca una presenza in più. La differenza con quello del mese è solo il periodo: qui contano tutti gli eventi insieme, senza azzerarsi.",
      },
    },
    {
      id: "o12",
      titolo: "Media pagelle da 7.5",
      descrizione: "Media di tutti i voti che ci diamo dopo le partite",
      valore: mediaSquadra(ctx.pagelle),
      target: 7.5,
      unita: "di media",
      emoji: "📝",
      impatto: "Prestazioni di gruppo: la media sale se giochiamo da squadra.",
      dettaglio: {
        comeSiCalcola:
          "Media di tutti i voti dati dai giocatori nelle pagelle dopo le partite, arrotondata a una cifra decimale.",
        conta: ["Ogni voto dato in una pagella, a qualsiasi compagno."],
        nonConta: [
          "Gli autovoti: non si può votare se stessi.",
          "Le pagelle non compilate: non pesano sulla media.",
        ],
        periodo: "Tutta la stagione. Non si azzera e non ha scadenza.",
        fonte: "Pagelle compilate dai giocatori. Si aggiorna a ogni voto.",
        esempio:
          "Se i voti dati finora sono 7, 8 e 7, la media è 7.3: mancano 0.2 per arrivare a 7.5.",
      },
    },
    {
      id: "o13",
      titolo: "200 pagelle compilate",
      descrizione: "Quanti voti la squadra ha dato nel corso della stagione",
      valore: ctx.pagelle.length,
      target: 200,
      unita: "voti",
      emoji: "🗳️",
      impatto: "Vota i compagni a fine partita: bastano due minuti.",
      dettaglio: {
        comeSiCalcola:
          "Si contano tutti i voti dati nelle pagelle durante la stagione. Un voto è un giocatore che valuta un compagno dopo una partita.",
        conta: ["Ogni singolo voto dato a un compagno, non ogni pagella intera."],
        nonConta: ["Le pagelle non compilate.", "Gli autovoti, che non sono ammessi."],
        periodo: "Tutta la stagione. Non si azzera e non ha scadenza.",
        fonte: "Pagelle compilate dai giocatori. Si aggiorna a ogni voto.",
        esempio:
          "Se dopo una partita 10 giocatori votano 9 compagni ciascuno, la squadra aggiunge 90 voti.",
      },
    },
    {
      id: "o11",
      titolo: "Continuità di squadra",
      descrizione: "Giocatori con almeno 3 allenamenti consecutivi",
      valore: continui,
      target: 12,
      unita: "giocatori",
      emoji: "🔗",
      impatto: "Tieni viva la tua serie e sblocchi anche questo.",
      dettaglio: {
        comeSiCalcola:
          "Si conta quanti giocatori hanno una serie di almeno 3 allenamenti consecutivi senza saltarne nemmeno uno.",
        conta: ["Un giocatore con 3 o più allenamenti di fila in cui era presente o in ritardo."],
        nonConta: [
          "Chi ha saltato un allenamento: la serie riparte da zero.",
          "Un allenamento passato senza risposta vale come assenza e azzera la serie.",
          "Le partite: la serie riguarda solo gli allenamenti.",
          "Un allenamento saltato per infortunio non la azzera: la serie resta ferma al valore di prima.",
        ],
        periodo: "Si aggiorna di continuo sugli allenamenti passati. Non ha scadenza.",
        fonte: "Presenze agli allenamenti. Vedi anche la serie personale nel tuo profilo.",
        esempio:
          "Il target è 12 perché è il numero minimo per un allenamento 6 contro 6. Con 9 giocatori in serie ne mancano 3.",
      },
    },
    {
      id: "o3",
      titolo: "Prima vittoria del campionato",
      descrizione: "Sbloccare la stagione con i primi 3 punti",
      valore: Math.min(vittorie, 1),
      target: 1,
      unita: "vittorie",
      emoji: "🎉",
      impatto: "Una prestazione di gruppo e il primo passo è fatto.",
      dettaglio: {
        comeSiCalcola:
          "Si contano le partite di campionato vinte dalla squadra: vince chi si aggiudica più set. L'obiettivo si completa con la prima vittoria.",
        conta: [
          "Ogni partita ufficiale di campionato in cui abbiamo vinto più set degli avversari.",
        ],
        nonConta: [
          "Le sconfitte e le partite non ancora giocate.",
          "Amichevoli e allenamenti.",
          "Le vittorie oltre il target: il contatore si ferma al traguardo.",
        ],
        periodo: "Tutta la stagione di campionato. Non si azzera.",
        fonte:
          "Risultati ufficiali del portale CSI Bologna. Si aggiorna quando il portale pubblica il risultato, quindi può esserci un ritardo.",
        esempio: "Un 3-1 è una vittoria. Un 2-3 non lo è, anche se abbiamo vinto due set.",
      },
    },
    {
      id: "o4",
      titolo: "5 vittorie in campionato",
      descrizione: "Metà strada verso la zona playoff",
      valore: Math.min(vittorie, 5),
      target: 5,
      unita: "vittorie",
      emoji: "🔥",
      impatto: "Ogni vittoria ci avvicina ai playoff.",
      dettaglio: {
        comeSiCalcola:
          "Si contano le partite di campionato vinte dalla squadra: vince chi si aggiudica più set. L'obiettivo si completa con 5 vittorie.",
        conta: [
          "Ogni partita ufficiale di campionato in cui abbiamo vinto più set degli avversari.",
        ],
        nonConta: [
          "Le sconfitte e le partite non ancora giocate.",
          "Amichevoli e allenamenti.",
          "Le vittorie oltre il target: il contatore si ferma al traguardo.",
        ],
        periodo: "Tutta la stagione di campionato. Non si azzera.",
        fonte:
          "Risultati ufficiali del portale CSI Bologna. Si aggiorna quando il portale pubblica il risultato, quindi può esserci un ritardo.",
        esempio: "Un 3-1 è una vittoria. Un 2-3 non lo è, anche se abbiamo vinto due set.",
      },
    },
    {
      id: "o5",
      titolo: "10 vittorie in campionato",
      descrizione: "Obiettivo stagionale per il podio",
      valore: Math.min(vittorie, 10),
      target: 10,
      unita: "vittorie",
      emoji: "🏆",
      impatto: "L'obiettivo grande: serve tutta la stagione insieme.",
      dettaglio: {
        comeSiCalcola:
          "Si contano le partite di campionato vinte dalla squadra: vince chi si aggiudica più set. L'obiettivo si completa con 10 vittorie.",
        conta: [
          "Ogni partita ufficiale di campionato in cui abbiamo vinto più set degli avversari.",
        ],
        nonConta: [
          "Le sconfitte e le partite non ancora giocate.",
          "Amichevoli e allenamenti.",
          "Le vittorie oltre il target: il contatore si ferma al traguardo.",
        ],
        periodo: "Tutta la stagione di campionato. Non si azzera.",
        fonte:
          "Risultati ufficiali del portale CSI Bologna. Si aggiorna quando il portale pubblica il risultato, quindi può esserci un ritardo.",
        esempio: "Un 3-1 è una vittoria. Un 2-3 non lo è, anche se abbiamo vinto due set.",
      },
    },
    {
      id: "o6",
      titolo: "1 evento di squadra al mese",
      descrizione: "Pizzate, cene e uscite fuori dal campo",
      // Conta solo quando l'ora dell'evento è arrivata, non quando viene definito.
      valore: ctx.eventi.filter(
        (e) =>
          e.tipo === "evento" &&
          e.data.startsWith(mese) &&
          `${e.data} ${e.ora || "00:00"}` <= adessoRoma(oggi),
      ).length,
      target: 1,
      unita: "eventi",
      emoji: "🍕",
      impatto: "Il gruppo si costruisce anche fuori dal campo.",
      dettaglio: {
        comeSiCalcola:
          "Si conta quanti eventi di squadra del mese corrente sono già iniziati. Basta uno per completare l'obiettivo.",
        conta: [
          "Pizzate, cene e uscite fuori dal campo inserite nel calendario come «evento».",
          "Solo quando l'ora dell'evento è arrivata. Se manca l'ora vale la mezzanotte.",
        ],
        nonConta: [
          "Un evento ancora nel futuro: creato oggi per la settimana prossima non conta ancora.",
          "Partite e allenamenti.",
          "Eventi di altri mesi.",
        ],
        periodo:
          "Si azzera il primo giorno di ogni mese. Il passaggio a completato compare al primo aggiornamento della pagina dopo l'ora dell'evento.",
        fonte: "Eventi del calendario.",
        esempio:
          "Una pizzata fissata il 20 alle 20:30: fino a quell'ora l'obiettivo resta 0/1, dopo diventa 1/1.",
      },
    },
  ];
}

export function progressoObiettivo(o: ObiettivoSquadra) {
  return Math.min(100, Math.round((o.valore / o.target) * 100));
}

export function obiettiviOrdinati(rosa?: Giocatore[], ctx?: ContestoObiettivi, oggi?: Date) {
  return obiettiviSquadra(rosa, ctx, oggi).sort((a, b) => {
    const pa = progressoObiettivo(a);
    const pb = progressoObiettivo(b);
    const ca = pa >= 100 ? 1 : 0;
    const cb = pb >= 100 ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return pb - pa;
  });
}

/** Microcopy motivazionale per un obiettivo di squadra. */
export function microcopyObiettivo(o: ObiettivoSquadra) {
  const pct = progressoObiettivo(o);
  const manca = Math.max(0, Math.round((o.target - o.valore) * 10) / 10);
  if (pct >= 100) return "Obiettivo centrato: grande squadra!";
  if (pct >= 90) return `Ci siamo quasi: mancano ${manca} ${o.unita}.`;
  if (pct >= 50) return `Oltre metà strada: ancora ${manca} ${o.unita}.`;
  if (pct > 0) return `Si parte: ${manca} ${o.unita} al traguardo.`;
  return "Tocca a noi far partire questo obiettivo.";
}
