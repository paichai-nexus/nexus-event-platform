export function createCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | boolean) => {
    const raw = String(value);
    const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${formulaSafe.replaceAll('"', '""')}"`;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean>>) {
  const csv = createCsv(rows);
  if (!csv) return false;
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
