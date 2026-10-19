/**
 * Utilitas Ekspor Data ke File CSV
 */

export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: string[]) {
  if (!rows || !rows.length) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  const columnKeys = headers || Object.keys(rows[0]);
  const headerRow = columnKeys.join(",");

  const csvRows = rows.map((row) => {
    return columnKeys
      .map((key) => {
        let val = row[key];
        if (val === null || val === undefined) {
          val = "";
        }
        val = String(val).replace(/"/g, '""');
        if (val.includes(",") || val.includes("\n") || val.includes('"')) {
          val = `"${val}"`;
        }
        return val;
      })
      .join(",");
  });

  const csvContent = "\uFEFF" + [headerRow, ...csvRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
