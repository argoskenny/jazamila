const fs = require("node:fs");
const path = require("node:path");

function readEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^"|"$/g, "");
        return [key, value];
      })
  );
}

function sqlitePathFromUrl(url) {
  if (!url || !url.startsWith("file:")) return null;
  const filePath = url.slice("file:".length);
  if (filePath.startsWith("/")) return filePath;
  return path.resolve(__dirname, filePath);
}

const env = readEnvFile();
const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL || "file:./dev.db";
const sqlitePath = sqlitePathFromUrl(databaseUrl);

if (sqlitePath) {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  fs.closeSync(fs.openSync(sqlitePath, "a"));
}
