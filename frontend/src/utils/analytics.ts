import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AnalyticsData, ExportFormat } from '../types/analytics';

export const exportAnalyticsData = (data: AnalyticsData, format: ExportFormat, filename: string) => {
  switch (format) {
    case 'CSV':
      exportToCSV(data, filename);
      break;
    case 'PDF':
      exportToPDF(data, filename);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

const exportToCSV = (data: AnalyticsData, filename: string) => {
  const csvData = prepareCSVData(data);
  const csv = Papa.unparse(csvData);
  downloadFile(csv, `${filename}.csv`, 'text/csv');
};

const exportToPDF = (data: AnalyticsData, filename: string) => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('Payment Gateway Analytics Report', 20, 20);

  // Date range
  doc.setFontSize(12);
  doc.text(`Report Period: ${data.dateRange.start} to ${data.dateRange.end}`, 20, 35);

  let yPosition = 50;

  // KPIs Section
  doc.setFontSize(16);
  doc.text('Key Performance Indicators', 20, yPosition);
  yPosition += 10;

  const kpiData = [
    ['Metric', 'Value'],
    ['Total Volume', `$${data.kpis.volume.total.toLocaleString()}`],
    ['Approved Volume', `$${data.kpis.volume.approved.toLocaleString()}`],
    ['Declined Volume', `$${data.kpis.volume.declined.toLocaleString()}`],
    ['Approval Rate', `${(data.kpis.volume.approvalRate * 100).toFixed(2)}%`],
    ['Decline Rate', `${(data.kpis.volume.declineRate * 100).toFixed(2)}%`]
  ];

  (doc as any).autoTable({
    startY: yPosition,
    head: [kpiData[0]],
    body: kpiData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // Fee Analytics
  doc.setFontSize(16);
  doc.text('Fee Analytics', 20, yPosition);
  yPosition += 10;

  const feeData = [
    ['Category', 'Amount'],
    ['Total Revenue', `$${data.fees.totalRevenue.toLocaleString()}`],
    ['Super Admin Share', `$${data.fees.revenueSplit.superAdmin.toLocaleString()}`],
    ['Partners Share', `$${data.fees.revenueSplit.partners.toLocaleString()}`],
    ['Agents Share', `$${data.fees.revenueSplit.agents.toLocaleString()}`],
    ['Merchants Share', `$${data.fees.revenueSplit.merchants.toLocaleString()}`]
  ];

  (doc as any).autoTable({
    startY: yPosition,
    head: [feeData[0]],
    body: feeData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [46, 204, 113] }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // FX Margins
  doc.setFontSize(16);
  doc.text('FX Margins', 20, yPosition);
  yPosition += 10;

  const fxData = [
    ['Metric', 'Value'],
    ['Total Margin', `$${data.fxMargins.totalMargin.toLocaleString()}`],
    ['Average Margin (bps)', data.fxMargins.averageMarginBps.toFixed(2)]
  ];

  (doc as any).autoTable({
    startY: yPosition,
    head: [fxData[0]],
    body: fxData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [155, 89, 182] }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // Settlement Performance
  doc.setFontSize(16);
  doc.text('Settlement Performance', 20, yPosition);
  yPosition += 10;

  const settlementData = [
    ['Metric', 'Value'],
    ['Total Settlements', data.settlementPerformance.totalSettlements.toString()],
    ['Successful Settlements', data.settlementPerformance.successfulSettlements.toString()],
    ['Success Rate', `${(data.settlementPerformance.settlementSuccessRate * 100).toFixed(2)}%`],
    ['Average Settlement Time', `${data.settlementPerformance.averageSettlementTime.toFixed(1)} hours`],
    ['Settlement Volume', `$${data.settlementPerformance.settlementVolume.toLocaleString()}`]
  ];

  (doc as any).autoTable({
    startY: yPosition,
    head: [settlementData[0]],
    body: settlementData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 126, 34] }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // Notification Stats
  doc.setFontSize(16);
  doc.text('Notification Delivery Stats', 20, yPosition);
  yPosition += 10;

  const notificationData = [
    ['Metric', 'Value'],
    ['Total Sent', data.notificationStats.totalSent.toString()],
    ['Delivered', data.notificationStats.delivered.toString()],
    ['Failed', data.notificationStats.failed.toString()],
    ['Delivery Rate', `${(data.notificationStats.deliveryRate * 100).toFixed(2)}%`],
    ['Average Delivery Time', `${data.notificationStats.averageDeliveryTime.toFixed(1)}s`]
  ];

  (doc as any).autoTable({
    startY: yPosition,
    head: [notificationData[0]],
    body: notificationData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [52, 152, 219] }
  });

  doc.save(`${filename}.pdf`);
};

const prepareCSVData = (data: AnalyticsData): any[] => {
  const rows: any[] = [];

  // KPIs
  rows.push(['Section', 'Metric', 'Value']);
  rows.push(['KPIs', 'Total Volume', data.kpis.volume.total]);
  rows.push(['KPIs', 'Approved Volume', data.kpis.volume.approved]);
  rows.push(['KPIs', 'Declined Volume', data.kpis.volume.declined]);
  rows.push(['KPIs', 'Approval Rate', data.kpis.volume.approvalRate]);
  rows.push(['KPIs', 'Decline Rate', data.kpis.volume.declineRate]);

  // Channel Type Breakdown
  Object.entries(data.kpis.byChannelType).forEach(([channel, stats]) => {
    rows.push(['Channel Type', channel, 'Volume', stats.volume]);
    rows.push(['Channel Type', channel, 'Approved', stats.approved]);
    rows.push(['Channel Type', channel, 'Declined', stats.declined]);
    rows.push(['Channel Type', channel, 'Approval Rate', stats.approvalRate]);
  });

  // Fee Analytics
  rows.push(['Fees', 'Total Revenue', data.fees.totalRevenue]);
  rows.push(['Fees', 'Super Admin Share', data.fees.revenueSplit.superAdmin]);
  rows.push(['Fees', 'Partners Share', data.fees.revenueSplit.partners]);
  rows.push(['Fees', 'Agents Share', data.fees.revenueSplit.agents]);
  rows.push(['Fees', 'Merchants Share', data.fees.revenueSplit.merchants]);

  // FX Margins
  rows.push(['FX Margins', 'Total Margin', data.fxMargins.totalMargin]);
  rows.push(['FX Margins', 'Average Margin (bps)', data.fxMargins.averageMarginBps]);

  // Settlement Performance
  rows.push(['Settlement', 'Total Settlements', data.settlementPerformance.totalSettlements]);
  rows.push(['Settlement', 'Successful Settlements', data.settlementPerformance.successfulSettlements]);
  rows.push(['Settlement', 'Success Rate', data.settlementPerformance.settlementSuccessRate]);
  rows.push(['Settlement', 'Average Time (hours)', data.settlementPerformance.averageSettlementTime]);

  // Notification Stats
  rows.push(['Notifications', 'Total Sent', data.notificationStats.totalSent]);
  rows.push(['Notifications', 'Delivered', data.notificationStats.delivered]);
  rows.push(['Notifications', 'Failed', data.notificationStats.failed]);
  rows.push(['Notifications', 'Delivery Rate', data.notificationStats.deliveryRate]);

  return rows;
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};