/**
 * ZKCommerce v4.1 -- Database Manager (Node.js only, no psql required)
 * Works on Windows PowerShell, Mac, Linux
 * Usage: node deployment/scripts/db-manager.js <command> [environment]
 */
"use strict";

const { Client } = require("pg");
const path = require("path");
const fs   = require("fs");

const cmd = process.argv[2];
const env = process.argv[3] || process.env.NODE_ENV || "development";

// Load env file
const envFile = path.join(__dirname, "../environments", ".env." + env);
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  lines.forEach(function(line) {
    if (!line || line.startsWith("#")) return;
    const idx = line.indexOf("=");
    if (idx < 0) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  });
}

const DB_URL = process.env.DATABASE_URL
  || process.env.DATABASE_DevURL
  || process.env.DATABASE_DEVURL;

const LOG_DIR = path.join(__dirname, "../logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg, level) {
  const l = level || "INFO";
  const colours = { INFO: "\x1b[36m", PASS: "\x1b[32m", ERROR: "\x1b[31m", WARN: "\x1b[33m" };
  const line = "[" + new Date().toISOString() + "] [" + l + "] " + msg;
  console.log((colours[l] || "") + line + "\x1b[0m");
  fs.appendFileSync(path.join(LOG_DIR, "database.log"), line + "\n");
}

function die(msg) { log(msg, "ERROR"); process.exit(1); }

async function getClient() {
  if (!DB_URL) die("DATABASE_URL not set. Add it to .env or deployment/environments/.env." + env);
  const ssl = DB_URL.includes("neon.tech") || DB_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString: DB_URL, ssl });
  await client.connect();
  return client;
}

async function cmdStatus() {
  log("Database status [" + env + "]");
  const client = await getClient();
  try {
    const ver   = await client.query("SELECT version()");
    log(ver.rows[0].version.split(",")[0], "PASS");
    const tbls  = await client.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'public\'");
    log("Tables: " + tbls.rows[0].count, "PASS");
    for (const t of ["users","stores","products","orders"]) {
      try {
        const r = await client.query("SELECT COUNT(*) FROM " + t);
        log(t + ": " + r.rows[0].count + " rows", "PASS");
      } catch(e) { log(t + ": missing", "WARN"); }
    }
  } finally { await client.end(); }
}

async function cmdMigrate() {
  log("Running migration [" + env + "]");
  const client = await getClient();
  const files = [
    "database/zkcommerce-master.sql",
    "database/zkcommerce-additions.sql",
  ];
  for (const f of files) {
    const fp = path.join(process.cwd(), f);
    if (!fs.existsSync(fp)) { log("Skip: " + f + " (not found)", "WARN"); continue; }
    log("Running: " + f);
    const sql = fs.readFileSync(fp, "utf8");
    try {
      await client.query(sql);
      log(f + " -- OK", "PASS");
    } catch(e) {
      log(f + " -- " + e.message.split("\n")[0], "WARN");
    }
  }
  await client.end();
  log("Migration done", "PASS");
}

async function cmdBackup() {
  log("Backup [" + env + "] via pg SELECT");
  const client = await getClient();
  const backupDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  const file = path.join(backupDir, "zkcommerce-" + env + "-" + ts + ".json");
  const tables = ["users","stores","products","orders","order_items","payments",
                  "coupons","cart_items","loyalty_points","categories","reviews"];
  const backup = {};
  for (const t of tables) {
    try {
      const r = await client.query("SELECT * FROM " + t);
      backup[t] = r.rows;
      log(t + ": " + r.rows.length + " rows", "PASS");
    } catch(e) { log(t + ": skip (" + e.message.split("\n")[0] + ")", "WARN"); }
  }
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  const size = fs.statSync(file).size;
  log("Saved: " + file + " (" + Math.round(size/1024) + "KB)", "PASS");
  await client.end();
}

const COMMANDS = {
  status:  cmdStatus,
  migrate: cmdMigrate,
  backup:  cmdBackup,
  create:  async function() { log("Create: use Neon dashboard or createdb locally", "INFO"); },
  reset:   async function() {
    if (env === "production") die("Cannot reset production. Aborting.");
    log("Reset: running master migration", "WARN");
    await cmdMigrate();
  },
};

if (!cmd || !COMMANDS[cmd]) {
  console.log("\nUsage: node deployment/scripts/db-manager.js <command> [environment]");
  console.log("Commands: " + Object.keys(COMMANDS).join(" | "));
  process.exit(0);
}
log("DB Manager: " + cmd + " [" + env + "]");
COMMANDS[cmd]().catch(function(e) { die(e.message); });
