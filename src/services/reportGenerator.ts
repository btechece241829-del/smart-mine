// Report Generator Service for MineGov AI
import { DerivedMineMetrics, DatasetBundle } from '../types/minegov';

export function exportReportToCSV(reportTitle: string, rows: any[]) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]).join(',');
  const csvLines = rows.map(r => 
    Object.values(r).map(val => {
      const str = String(val ?? '');
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...csvLines].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerPrintReport(reportTitle: string) {
  window.print();
}
