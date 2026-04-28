import express from "express";
import session from "express-session";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(DATA_DIR, "db.json");

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Velion2026!";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

const DEFAULT_DB = {
  leads: [],
  offers: [],
  settings: {
    companyName: "Velion House",
    phone: "+7 (999) 123-45-67",
    heroTitle: "Коттеджные поселки и дома под ключ от компании Velion House",
    heroSubtitle:
      "Строим дома в поселках и на вашем собственном участке, выполняем ремонт и интерьерные работы под ключ.",
    heroImage: "./Строительный участок на солнечном дне.png",
  },
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

async function readDb() {
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function isAdmin(req) {
  return req.session?.isAdmin === true;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Не авторизован" });
  return next();
}

app.use(express.json({ limit: "10mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "velion-house-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 12 },
  })
);

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

app.post("/api/leads", async (req, res) => {
  const { name, phone, message } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: "Имя и телефон обязательны" });
  }
  const db = await readDb();
  db.leads.unshift({
    id: `lead_${Date.now()}`,
    name: String(name).trim(),
    phone: String(phone).trim(),
    message: String(message || "").trim(),
    createdAt: new Date().toISOString(),
    status: "new",
  });
  await writeDb(db);
  return res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const { login, password } = req.body || {};
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Неверный логин или пароль" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", (req, res) => {
  res.json({ isAdmin: isAdmin(req) });
});

app.get("/api/admin/leads", requireAdmin, async (_req, res) => {
  const db = await readDb();
  res.json(db.leads);
});

app.patch("/api/admin/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const db = await readDb();
  const lead = db.leads.find((item) => item.id === id);
  if (!lead) return res.status(404).json({ error: "Заявка не найдена" });
  lead.status = status || lead.status;
  await writeDb(db);
  res.json({ ok: true });
});

app.get("/api/offers", async (_req, res) => {
  const db = await readDb();
  res.json(db.offers.filter((x) => x.active !== false));
});

app.get("/api/admin/offers", requireAdmin, async (_req, res) => {
  const db = await readDb();
  res.json(db.offers);
});

app.post("/api/admin/offers", requireAdmin, async (req, res) => {
  const db = await readDb();
  const offer = {
    id: `offer_${Date.now()}`,
    title: req.body?.title || "Новая акция",
    description: req.body?.description || "",
    image: req.body?.image || "",
    active: req.body?.active !== false,
    createdAt: new Date().toISOString(),
  };
  db.offers.unshift(offer);
  await writeDb(db);
  res.json(offer);
});

app.put("/api/admin/offers/:id", requireAdmin, async (req, res) => {
  const db = await readDb();
  const offer = db.offers.find((x) => x.id === req.params.id);
  if (!offer) return res.status(404).json({ error: "Акция не найдена" });
  offer.title = req.body?.title ?? offer.title;
  offer.description = req.body?.description ?? offer.description;
  offer.image = req.body?.image ?? offer.image;
  offer.active = req.body?.active ?? offer.active;
  await writeDb(db);
  res.json(offer);
});

app.delete("/api/admin/offers/:id", requireAdmin, async (req, res) => {
  const db = await readDb();
  db.offers = db.offers.filter((x) => x.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

app.get("/api/settings", async (_req, res) => {
  const db = await readDb();
  res.json(db.settings);
});

app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
  const db = await readDb();
  res.json(db.settings);
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  const db = await readDb();
  db.settings = { ...db.settings, ...req.body };
  await writeDb(db);
  res.json(db.settings);
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

await ensureStorage();
app.listen(PORT, () => {
  console.log(`Velion House started: http://localhost:${PORT}`);
});
