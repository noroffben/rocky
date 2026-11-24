# Hundloggen

Familjens gemensamma logg för hunden. Öppna sidan på mobilen, se dagens händelser, bläddra bakåt
med pilarna och tryck "Lägg till" för att logga att hunden åt, rastades, bajsade eller skriva en kommentar.

Node + Express + Postgres (Neon). Frontend är en enda `index.html`. Ingen inloggning, ingen app.

## Miljövariabler

| Variabel | Beskrivning |
|---|---|
| `DATABASE_URL` | Connection string från Neon (den med `?sslmode=require`) |
| `DOG_NAME` | Hundens namn, t.ex. `Bella` (valfritt) |

`PORT` sätts automatiskt av Render.

## Deploy

### 1. GitHub
Skapa ett nytt repo

### 2. Neon
Skapa ett projekt och kopiera connection string. Tabellen skapas automatiskt när servern startar.

### 3. Render
1. New → Web Service → välj repot.
2. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
3. Lägg in `DATABASE_URL` och `DOG_NAME` under Environment.
4. Deploya. Du får en adress som `https://hundlogg.onrender.com`.

### 4. UptimeRobot
Skapa en HTTP(s)-monitor mot `https://DIN-APP.onrender.com/health` med 5 minuters intervall.
Det håller Rendern vaken på gratisnivån så att sidan inte är långsam när någon öppnar den.
`/health` rör inte databasen, så Neon kan fortfarande sova när ingen använder appen.

