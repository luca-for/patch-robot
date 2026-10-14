import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic"; //Impedisce a next di mettere in cache la risposta della route

// 1. Validazione preventiva e centralizzata delle variabili d'ambiente
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

const supabaseUrl = requireEnv("SUPABASE_URL")
const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const discordWebhookUrl = requireEnv("DISCORD_WEBHOOK_URL");
const cronSecret = requireEnv("CRON_SECRET");


const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function isAuthorized(request: Request): boolean {
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// ATTENZIONE: Riot usa un offset di stagione nell'URL del sito
const SEASON_URL_OFFSET = 10;
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;

export async function GET(request: Request) {
  try {
    // 2. CONTROLLO DI SICUREZZA: Protezione dell'endpoint Cron

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
    }

    // 3. Recupero dati da Supabase
    const { data: dbData, error: dbError } = await supabase
      .from("last_patch")
      .select("versione")
      .eq("id", 1)
      .single();

    if (dbError || !dbData) {
      console.error("Errore Supabase (lettura):", dbError);
      return NextResponse.json({ error: "Errore DB in lettura" }, { status: 500 });
    }

    const lastSavedVersion = dbData.versione;

    // 4. Fetch API Riot
    const riotResponse = await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );

    if (!riotResponse.ok) {
      return NextResponse.json(
        { error: "Impossibile contattare le API Riot Games" },
        { status: 502 }
      );
    }

    const versions = await riotResponse.json();
    const latestVersion: string = versions[0];
    if (typeof latestVersion !== "string" || !VERSION_REGEX.test(latestVersion)) {
      console.error("formato versione inatteso:", latestVersion);
      return NextResponse.json({ error: "risposta esterna non valida" }, { status: 502 });
    }

    // 5. Comparazione versioni
    if (latestVersion === lastSavedVersion) {
      return NextResponse.json({ message: "Nessuna nuova patch disponibile" });
    }

    // 6. Costruzione URL patch
    const versionParts = latestVersion.split(".");
    const apiMajorVersion = parseInt(versionParts[0], 10);
    const siteMajorVersion = apiMajorVersion + SEASON_URL_OFFSET;
    const minorVersion = versionParts[1];
    const patchUrl = `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-${siteMajorVersion}-${minorVersion}-notes/`;

    const payload = {
      username: "Patch-robot",
      content: "🛠️ Nuova Patch di LoL disponibile!",
      allowed_mentions: { parse: [] }, //evitare menzioni indesiderate
      embeds: [
        {
          title: `Note sulla patch ${siteMajorVersion}.${minorVersion}`,
          url: patchUrl,
          description: "Clicca per vedere le note della patch",
          color: 2067276,
          footer: {
            text: "Questo webhook non è approvato, affiliato o supportato da Riot Games.",
          },
        },
      ],
    };

    // 7. Invio notifica Discord — se fallisce, non aggiorniamo il DB
    const discordRes = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!discordRes.ok) {
      console.error("Discord webhook fallito:", discordRes.status);
      return NextResponse.json(
        { error: "Notifica Discord fallita, DB non aggiornato" },
        { status: 502 }
      );
    }

    // 8. Aggiornamento DB — solo dopo conferma invio Discord
    const { error: updateError } = await supabase
      .from("last_patch")
      .update({ versione: latestVersion })
      .eq("id", 1);

    if (updateError) {
      // La notifica è già stata inviata: logghiamo ma non crashiamo
      console.error("Errore Supabase (aggiornamento versione):", updateError);
    }

    return NextResponse.json({
      message: "Notifica inviata con successo",
      version: latestVersion,
    });

  } catch (error) {
    console.error("Errore interno:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}