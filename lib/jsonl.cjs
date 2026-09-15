const fs = require("node:fs");
const path = require("node:path");

function writeJsonl(filePath, records) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  fs.writeFileSync(absolutePath, body ? `${body}\n` : "", "utf8");
  return absolutePath;
}

function readJsonl(filePath) {
  return fs.readFileSync(path.resolve(filePath), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
    });
}

module.exports = { readJsonl, writeJsonl };
