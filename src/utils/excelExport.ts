import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], fileName: string) {
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Convert the array of objects to a worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set some styling/column widths if desired
  const colWidths: {wch: number}[] = [];
  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => {
      colWidths.push({ wch: Math.max(key.length, 15) }); // Default width to 15 or key length
    });
  }
  ws['!cols'] = colWidths;

  // Append the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  
  // Write the file and trigger download
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
