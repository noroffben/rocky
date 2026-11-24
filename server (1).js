const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const DOG_NAME = process.env.DOG_NAME || 'Hunden';
const TZ = 'Europe/Stockholm';
const VALID_TAGS = ['ate', 'walked', 'pooped'];

if (!DATABASE_URL) {
  console.error('DATABASE_URL saknas');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logg (
      id SERIAL PRIMARY KEY,
      author TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS logg_created_idx ON logg (created_at DESC);
  `);
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));

// Be sökmotorer att inte indexera sidan.
app.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

// Används av UptimeRobot. Rör inte databasen så Neon får sova.
app.get('/health', (req, res) => res.send('ok'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/config', (req, res) => res.json({ dogName: DOG_NAME }));

// Alla händelser för ett datum (YYYY-MM-DD, svensk tid), senaste först.
app.get('/api/day', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Ogiltigt datum' });
  try {
    const { rows } = await pool.query(
      `SELECT id, author, tags, note, created_at FROM logg
       WHERE (created_at AT TIME ZONE '${TZ}')::date = $1::date
       ORDER BY created_at DESC`,
      [date]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Databasfel' });
  }
});

// Senaste gången hunden åt / rastades / bajsade, oavsett dag.
app.get('/api/last', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (tag) tag, author, created_at
       FROM logg, unnest(tags) AS tag
       ORDER BY tag, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Databasfel' });
  }
});

// Enkel spärr mot missbruk: max 30 inlägg per 10 min per IP.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of hits) {
    if (!ts.some((t) => now - t < 10 * 60 * 1000)) hits.delete(ip);
  }
}, 10 * 60 * 1000).unref();

app.post('/api/entries', async (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'För många inlägg, vänta lite' });
  const body = req.body || {};
  const author = String(body.author || '').trim().slice(0, 30);
  const note = String(body.note || '').trim().slice(0, 1000);
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags)].filter((t) => VALID_TAGS.includes(t)) : [];
  if (!author) return res.status(400).json({ error: 'Skriv ditt namn' });
  if (!tags.length && !note) return res.status(400).json({ error: 'Välj något eller skriv en kommentar' });
  // Valfri tid i svensk tid (datum + klockslag). Saknas båda används "nu".
  const date = body.date ? String(body.date) : null;
  const time = body.time ? String(body.time) : null;
  const badFormat =
    (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) ||
    (time && !/^\d{2}:\d{2}$/.test(time)) ||
    Boolean(date) !== Boolean(time) ||
    (date && Number.isNaN(Date.parse(`${date}T${time}:00Z`)));
  if (badFormat) return res.status(400).json({ error: 'Ogiltig tid' });
  try {
    const when = `COALESCE(($4::date + $5::time) AT TIME ZONE '${TZ}', now())`;
    const { rows } = await pool.query(
      `INSERT INTO logg (author, tags, note, created_at)
       SELECT $1, $2, $3, ${when}
       WHERE ${when} <= now() + interval '1 minute'
       RETURNING id, author, tags, note, created_at`,
      [author, tags, note, date, time]
    );
    if (!rows.length) return res.status(400).json({ error: 'Tiden har inte inträffat än' });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code && String(err.code).startsWith('22')) return res.status(400).json({ error: 'Ogiltig tid' });
    console.error(err);
    res.status(500).json({ error: 'Databasfel' });
  }
});

// Alla i familjen kan ta bort alla inlägg.
app.delete('/api/entries/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Ogiltigt anrop' });
  try {
    const { rowCount } = await pool.query('DELETE FROM logg WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Hittades inte' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Databasfel' });
  }
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`Lyssnar på port ${PORT}`)))
  .catch((err) => {
    console.error('Kunde inte starta:', err);
    process.exit(1);
  });
