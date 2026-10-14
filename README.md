# LoL Patch Notifier — Automated Cron Bot 🛠️

Un micro-servizio serverless automatizzato, sviluppato con **Next.js (App Router)** e **TypeScript**, che monitora il rilascio delle nuove patch di League of Legends tramite le API ufficiali di Riot Games. Se viene rilevata una nuova versione, il bot genera dinamicamente l'URL delle note della patch (gestendo l'offset stagionale) e invia una notifica formattata a un server Discord tramite Webhook, aggiornando infine lo stato su **Supabase**.

---

## Tech Stack

* **Framework:** Next.js
* **Linguaggio:** TypeScript
* **Database:** Supabase (PostgreSQL)
* **Hosting & Automation:** Vercel (Serverless Functions + Vercel Cron Jobs)
* **Package Manager:** pnpm
* **Integrazioni:** Riot Games API (Data Dragon) & Discord Webhooks

---

## Highlights di Architettura & Sicurezza

* **Protezione Endpoint (Security by Design):** L'endpoint `/api/cron/lol-patch` è protetto in produzione tramite verifica del token nell'header `Authorization`, confrontato con un `CRON_SECRET` configurato come *Sensitive Value* su Vercel. Qualsiasi richiesta non autorizzata viene rigettata con **HTTP 401**.

* **Bypass in Sviluppo:** Il controllo di sicurezza legge `process.env.NODE_ENV`: in ambiente `development` il token non viene richiesto, così il testing locale non dipende dalle chiavi di produzione.

* **Fail-Safe con retry garantito:** Il DB viene aggiornato **solo dopo** che il Webhook Discord restituisce `200 OK`. Se Discord è irraggiungibile, la versione su Supabase rimane quella precedente: al ciclo Cron successivo il sistema ritenterà automaticamente, eliminando il rischio di notifiche perse in silenzio.

* **Validazione preventiva delle variabili d'ambiente:** All'avvio della Serverless Function, tutte le stringhe di connessione vengono validate. Se una variabile è assente, viene lanciata un'eccezione immediata che blocca il boot anziché produrre errori silenziosi a runtime.

---

## Flusso Logico

1. **Trigger** — Vercel Cron Job esegue la chiamata pianificata
2. **Auth** — Validazione del token nell'header di sicurezza
3. **Read DB** — Recupero dell'ultima versione notificata da Supabase
4. **Fetch Riot** — Interrogazione di Data Dragon (`versions.json`) senza cache
5. **Diff Check:**
   - Versione invariata → risposta `200` senza azioni
   - Nuova versione rilevata → il flusso prosegue
6. **Data Processing** — Parsing della versione e calcolo dell'URL con `SEASON_URL_OFFSET`
7. **Dispatch** — Invio dell'embed al canale Discord
8. **Write DB** — Aggiornamento della versione su Supabase

---

## Variabili d'Ambiente

### Locale (`.env.local`)

```env
SUPABASE_URL=             # URL del progetto (Supabase Dashboard → Settings → API)
SUPABASE_SERVICE_KEY=     # Service role key (Supabase Dashboard → Settings → API)
DISCORD_WEBHOOK_URL=      # URL del webhook del canale Discord
CRON_SECRET=              # Token segreto per proteggere l'endpoint cron
```

### Produzione (Vercel)

Le stesse variabili vanno configurate su Vercel in **Settings → Environment Variables**.  
`SUPABASE_SERVICE_KEY` e `CRON_SECRET` devono essere marcate come **Sensitive**.

---

> Questo progetto non è approvato, affiliato o supportato da Riot Games.