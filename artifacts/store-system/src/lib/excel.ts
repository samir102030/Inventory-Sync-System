import * as XLSX from "@e965/xlsx";

export function exportToExcel(headers: string[], rows: (string | number | null | undefined)[][], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        if (!all.length) return resolve({ headers: [], rows: [] });
        const headers = (all[0] as string[]).map(String);
        const rows = (all.slice(1) as string[][]).map(r => r.map(String));
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
