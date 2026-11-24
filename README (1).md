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
Skapa ett nytt repo (gärna privat) och pusha mappen:

```bash
git init
git add .
git commit -m "Hundloggen"
git branch -M main
git remote add origin https://github.com/DITT-NAMN/hundlogg.git
git push -u origin main
```

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

## Köra lokalt

```bash
npm install
DATABASE_URL="postgres://..." DOG_NAME=Bella npm start
```

## Gott att veta
- Det finns inget lösenord: alla som har länken kan läsa och skriva. Dela länken bara med familjen.
  Sidan ber sökmotorer att inte indexera den, och det finns en spärr på max 30 inlägg per 10 minuter per IP.
- Namnet skriver man själv och mobilen kommer ihåg det. Man kan bara ta bort inlägg med exakt samma namn som man har sparat.
- Dagarna räknas i svensk tid (Europe/Stockholm).
- Klockslaget i formuläret är förifyllt med nu, men kan ändras så att man kan logga i efterhand. Inlägg sorteras på det klockslaget. Framtida tider nekas.
- Trycker man Lägg till medan man tittar på en tidigare dag hamnar inlägget på den dagen.
- Tips: lägg sidan på hemskärmen (Dela → Lägg till på hemskärmen) så öppnas den som en app.
