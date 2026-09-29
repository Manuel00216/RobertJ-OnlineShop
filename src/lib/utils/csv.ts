/** Builds a CSV string from headers + rows and triggers a browser download. Client-only (uses Blob/URL/DOM APIs). */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
): void {
  const escape = (value: string | number | null) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
