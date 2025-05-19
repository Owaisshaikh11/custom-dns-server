const fs = require("fs");
const path = require("path");
const { DEFAULT_TTL } = require("./types");

const cache = new Map();
let records = {};

function loadRecords(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    records = JSON.parse(raw);
    console.log(`Loaded DNS records from ${filePath}`);
  } catch (err) {
    if (err.code === "ENOENT") { // if the file doesn't exist create a empty one with records obj
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
      console.log(`Created default records at ${filePath}`);
    } else {
      console.error(`Error loading records: ${err.message}`);
    }
  }
}

function saveRecords(filePath) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    console.log(`Saved DNS records to ${filePath}`);
  } catch (err) {
    console.error(`Error saving records: ${err.message}`);
  }
}

function getRecords() {
  return records;
}

module.exports = {
  cache,
  loadRecords,
  saveRecords,
  getRecords,
};
