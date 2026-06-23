export async function loadPlayers(path = "./data/players.csv") {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`CSV読込に失敗しました (${response.status})`);
  }
  const text = await response.text();
  const rows = parseCsv(text).filter((row) => row.length && row.some(Boolean));
  const header = rows.shift();
  if (!header || header.length < 8) {
    throw new Error("CSVヘッダーが不正です");
  }

  return rows
    .map((row, index) => ({
      id: normalizeId(row[0], index),
      name: row[1]?.trim() || `Player ${index + 1}`,
      ovr: Number.parseInt(row[2], 10),
      image: upscaleSofifaImageUrl(row[3]?.trim() || "./assets/placeholder.svg"),
      club: row[4]?.trim() || "Unknown Club",
      clubId: row[5]?.trim() || "",
      emblem: upscaleSofifaImageUrl(row[6]?.trim() || ""),
      league: row[7]?.trim() || "Unknown League"
    }))
    .filter((player) => Number.isFinite(player.ovr));
}

export function upscaleSofifaImageUrl(url) {
  return url
    .replace(/_(?:120|180)\.png$/i, "_240.png")
    .replace(/\/(?:120|180)\.png$/i, "/240.png");
}

function normalizeId(value, index) {
  const numberId = Number.parseInt(value, 10);
  return Number.isFinite(numberId) ? numberId : `player-${index + 1}`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}
