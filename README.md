# 🤖 Patch Robot — LoL Patch Monitor Cron

Un microservizio serverless automatizzato sviluppato in **Next.js (App Router)** e **TypeScript** che monitora le nuove patch di *League of Legends* tramite le API ufficiali di Riot Games (Data Dragon), invia notifiche formattate a **Discord** via Webhook e salva lo stato persistente su **Supabase**.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (Serverless Route Handler)
- **Linguaggio:** TypeScript
- **Database:** Supabase 
- **Sicurezza:** Node.js 
- **Integrazioni:** Riot Games API (Data Dragon) & Discord Webhooks

---

## ⚡ Highlights Ingegneristici del Codice

- **Timing-Safe Authentication:** L'endpoint Cron gestisce l'autorizzazione Bearer tramite `crypto.timingSafeEqual` per prevenire attacchi di tipo *timing attack*.
- **Fail-Fast Environment Boot:** Validazione centralizzata all'avvio delle variabili d'ambiente (`requireEnv`) con eccezioni bloccanti immediate in caso di parametri mancanti.
- **Fail-Safe Pipeline (Retry Garantito):** Il database Supabase viene aggiornato **esclusivamente dopo** l'esito positivo del Webhook Discord (`200 OK`). In caso di errore di consegna, il DB rimane invariato garantendo il ri-tentativo al ciclo successivo.
- **Robustezza & Input Sanitation:** 
  - Timeout forzati a `10s` (`AbortSignal.timeout`) sulle chiamate esterne (Riot & Discord).
  - Validazione tramite Regex (`/^\d+\.\d+\.\d+$/`) sui dati ricevuti da Data Dragon.
  - `allowed_mentions: { parse: [] }` nel payload Discord per bloccare menzioni indesiderate (`@everyone`).

---

## 🔑 Variabili d'Ambiente (`.env.local`)

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DISCORD_WEBHOOK_URL
CRON_SECRET
