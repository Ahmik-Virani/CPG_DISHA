export function normalizeRollNoInput(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

export function createOneTimeRow(rowId, rollNo = "", amount = "") {
  return {
    rowKey: rowId,
    rollNo,
    amount,
  };
}

const ROLL_NO_HEADERS = ["rollno", "roll_no", "roll no"];
const AMOUNT_HEADERS = ["amount", "amt"];
const SERIAL_NO_HEADERS = ["sl_no", "slno", "s_no", "sno", "serial_no", "serial no"];

function normalizeHeaderName(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("CSV contains unclosed quotes.");
  }

  cells.push(current.trim());
  return cells;
}

function findHeaderIndex(headers, allowedNames) {
  for (let index = 0; index < headers.length; index += 1) {
    if (allowedNames.includes(headers[index])) {
      return index;
    }
  }
  return -1;
}

export function parseOneTimeCsv(csvText) {
  const normalizedText = String(csvText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalizedText.split("\n");

  while (rawLines.length && rawLines[rawLines.length - 1].trim() === "") {
    rawLines.pop();
  }

  if (!rawLines.length) {
    throw new Error("CSV file is empty.");
  }

  for (let i = 0; i < rawLines.length; i += 1) {
    const isHeader = i === 0;
    if (rawLines[i].trim() === "" && !isHeader) {
      throw new Error(`Blank row found at line ${i + 1}. Remove blank rows and retry.`);
    }
  }

  const parsedHeader = parseCsvLine(rawLines[0]).map((header) => normalizeHeaderName(header));
  const rollNoIndex = findHeaderIndex(parsedHeader, ROLL_NO_HEADERS);
  const amountIndex = findHeaderIndex(parsedHeader, AMOUNT_HEADERS);
  const serialNoIndex = findHeaderIndex(parsedHeader, SERIAL_NO_HEADERS);

  if (rollNoIndex < 0 || amountIndex < 0) {
    throw new Error("CSV header must include RollNo and Amount columns.");
  }

  const rows = [];
  const seenRollNos = new Set();

  for (let i = 1; i < rawLines.length; i += 1) {
    const rowLineNumber = i + 1;
    const values = parseCsvLine(rawLines[i]);

    const rollNoRaw = values[rollNoIndex];
    const amountRaw = values[amountIndex];
    const serialNoRaw = serialNoIndex >= 0 ? values[serialNoIndex] : "";

    const rollNo = normalizeRollNoInput(rollNoRaw);
    const amountText = String(amountRaw || "").trim();
    const amount = Number(amountText);

    const hasAnyData = [serialNoRaw, rollNoRaw, amountRaw].some(
      (value) => String(value || "").trim() !== ""
    );

    if (!hasAnyData) {
      throw new Error(`Blank row found at line ${rowLineNumber}. Remove blank rows and retry.`);
    }

    if (!rollNo) {
      throw new Error(`Missing RollNo at line ${rowLineNumber}.`);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Amount must be greater than 0 at line ${rowLineNumber}.`);
    }

    if (seenRollNos.has(rollNo)) {
      throw new Error(`Duplicate RollNo ${rollNo} found at line ${rowLineNumber}.`);
    }

    seenRollNos.add(rollNo);
    rows.push(createOneTimeRow(i, rollNo, amountText));
  }

  if (!rows.length) {
    throw new Error("CSV must contain at least one data row.");
  }

  return rows;
}

export const ONE_TIME_CSV_EXAMPLE = [
  "sl_no,roll_no,amount",
  "1,CS24BTECH11001,500",
  "2,CS24BTECH11002,750",
].join("\n");
