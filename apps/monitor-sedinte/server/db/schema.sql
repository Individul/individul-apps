CREATE TABLE IF NOT EXISTS persoane_monitorizate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nume TEXT NOT NULL,
  instante TEXT NOT NULL DEFAULT '["jc","jsr","jbl","jch","jcm","jed","jhn","jun","jor","jcs","jst","jcl","jan","jri","cac","cab","cach"]',
  tip_dosar TEXT NOT NULL DEFAULT 'Any',
  activ INTEGER NOT NULL DEFAULT 1,
  creat_la TEXT NOT NULL DEFAULT (datetime('now')),
  nota TEXT
);

CREATE TABLE IF NOT EXISTS sedinte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash_unic TEXT UNIQUE NOT NULL,
  persoana_id INTEGER NOT NULL REFERENCES persoane_monitorizate(id),
  instanta_cod TEXT NOT NULL,
  instanta_nume TEXT NOT NULL,
  numar_dosar TEXT NOT NULL,
  judecator TEXT,
  data_sedinta TEXT NOT NULL,
  data_sedinta_iso TEXT NOT NULL,
  ora TEXT,
  sala TEXT,
  denumire_dosar TEXT,
  obiect_cauza TEXT,
  tip_dosar TEXT,
  tip_sedinta TEXT,
  rezultat TEXT,
  pdf_link TEXT,
  prima_detectare TEXT NOT NULL DEFAULT (datetime('now')),
  ultima_verificare TEXT
);

CREATE TABLE IF NOT EXISTS modificari_sedinte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sedinta_id INTEGER NOT NULL REFERENCES sedinte(id),
  camp_modificat TEXT NOT NULL,
  valoare_veche TEXT,
  valoare_noua TEXT,
  detectat_la TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verificari_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  persoana_id INTEGER,
  instanta_cod TEXT,
  sedinte_gasite INTEGER DEFAULT 0,
  sedinte_noi INTEGER DEFAULT 0,
  eroare TEXT,
  durata_ms INTEGER
);

CREATE TABLE IF NOT EXISTS setari (
  cheie TEXT PRIMARY KEY,
  valoare TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotarari (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash_unic TEXT UNIQUE NOT NULL,
  persoana_id INTEGER NOT NULL REFERENCES persoane_monitorizate(id),
  instanta_cod TEXT NOT NULL,
  instanta_nume TEXT NOT NULL,
  numar_dosar TEXT NOT NULL,
  tip_act TEXT NOT NULL,
  data_pronuntare TEXT,
  data_pronuntare_iso TEXT,
  judecator TEXT,
  solutie TEXT,
  pdf_link TEXT,
  prima_detectare TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sedinte_persoana ON sedinte(persoana_id);
CREATE INDEX IF NOT EXISTS idx_sedinte_data_iso ON sedinte(data_sedinta_iso);
CREATE INDEX IF NOT EXISTS idx_sedinte_hash ON sedinte(hash_unic);
CREATE INDEX IF NOT EXISTS idx_sedinte_instanta ON sedinte(instanta_cod);
CREATE INDEX IF NOT EXISTS idx_modificari_sedinta ON modificari_sedinte(sedinta_id);
CREATE INDEX IF NOT EXISTS idx_verificari_timestamp ON verificari_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_hotarari_persoana ON hotarari(persoana_id);
CREATE INDEX IF NOT EXISTS idx_hotarari_data ON hotarari(data_pronuntare_iso);
