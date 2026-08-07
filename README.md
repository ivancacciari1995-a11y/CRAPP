# CrAPP 🏐

CrAPP è una Progressive Web App sviluppata per digitalizzare completamente la gestione di una squadra di pallavolo.

## Funzionalità principali

- Gestione squadra
- Gestione presenze
- Calendario allenamenti e partite
- Scout Live
- Badge e gamification
- Statistiche
- Notifiche intelligenti
- Gestione amministrativa
- AI per la pianificazione degli allenamenti (in sviluppo)

---

## Stack tecnologico

- React 19
- TypeScript
- TanStack Start
- Vite
- Tailwind CSS
- Supabase
- GitHub
- Vercel

---

## Ambienti

- `main` → Produzione
- `develop` → Sviluppo

---

## Avvio locale

```bash
npm install
npm run dev
```

L'app sarà disponibile su:

```
http://localhost:8080
```

---

## Build

```bash
npm run build
```

---

## Deploy

Il deploy è automatico tramite Vercel ad ogni push sul branch `main`.

Le modifiche sviluppate nel branch `develop` vengono pubblicate automaticamente come Preview Deployment.

---

## Variabili d'ambiente

Il progetto richiede le seguenti variabili:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Repository

Il codice sorgente è gestito tramite GitHub.

Flusso di sviluppo:

```
develop
    ↓
Test
    ↓
Merge su main
    ↓
Deploy automatico Vercel
```