import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ------------------------------------------------------------
   Map raw ticket fields to display-friendly values
   ------------------------------------------------------------ */
const PRIORITY_TEXT = { 1: 'High', 2: 'Medium', 3: 'Low' };
const STATUS_TEXT = {
  100: 'Open',
  101: 'In Progress',
  102: 'In Progress',
  103: 'Pending',
  104: 'Resolved',
  105: 'Closed',
};

function toRow(t, idx) {
  return {
    'S.No': idx + 1,
    'Ticket ID': t.ticketNumber || '',
    'Issue': t.ticketDescription || '',
    'Agent': t.ticketSupportUserName || 'Unassigned',
    'SLA': t.slaText || '',           // computed client-side before export
    'Priority': PRIORITY_TEXT[t.ticketPriority] || '-',
    'Status': STATUS_TEXT[t.ticketStatus] || 'Unknown',
    'Created On': t.ticketCreatedOn || '',
    'Closed On': t.ticketClosedDate || '',
  };
}

/* ------------------------------------------------------------
   Excel export
   ------------------------------------------------------------ */
export function exportToExcel(tickets, meta = {}) {
  const rows = tickets.map((t, i) => toRow(t, i));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 6 },   // S.No
    { wch: 22 },  // Ticket ID
    { wch: 40 },  // Issue
    { wch: 18 },  // Agent
    { wch: 16 },  // SLA
    { wch: 10 },  // Priority
    { wch: 14 },  // Status
    { wch: 20 },  // Created On
    { wch: 20 },  // Closed On
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

  // Metadata sheet
  if (meta) {
    const metaRows = [
      ['Report',        meta.title || 'Tickets'],
      ['Generated On',  new Date().toLocaleString()],
      ['Total Rows',    tickets.length],
      ['Filter',        meta.filterLabel || 'All'],
      ['Search',        meta.search || '—'],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
    wsMeta['!cols'] = [{ wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Info');
  }

  const fileName = buildFileName(meta, 'xlsx');
  XLSX.writeFile(wb, fileName);
}

/* ------------------------------------------------------------
   PDF export
   ------------------------------------------------------------ */
export function exportToPDF(tickets, meta = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(10, 37, 64);
  doc.text(meta.title || 'Tickets Report', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(105, 115, 134);
  doc.text(
    `Generated on ${new Date().toLocaleString()} · ${tickets.length} row${tickets.length !== 1 ? 's' : ''}`,
    40,
    58
  );

  if (meta.filterLabel || meta.search) {
    const filterLine = [
      meta.filterLabel ? `Filter: ${meta.filterLabel}` : null,
      meta.search ? `Search: ${meta.search}` : null,
    ].filter(Boolean).join('   |   ');
    if (filterLine) doc.text(filterLine, 40, 74);
  }

  // Table
  const columns = [
    { header: 'S.No',        dataKey: 'sno' },
    { header: 'Ticket ID',   dataKey: 'ticketId' },
    { header: 'Issue',       dataKey: 'issue' },
    { header: 'Agent',       dataKey: 'agent' },
    { header: 'SLA',         dataKey: 'sla' },
    { header: 'Priority',    dataKey: 'priority' },
    { header: 'Status',      dataKey: 'status' },
    { header: 'Created On',  dataKey: 'createdOn' },
  ];

  const body = tickets.map((t, i) => ({
    sno: i + 1,
    ticketId: t.ticketNumber || '',
    issue: t.ticketDescription || '',
    agent: t.ticketSupportUserName || 'Unassigned',
    sla: t.slaText || '',
    priority: PRIORITY_TEXT[t.ticketPriority] || '-',
    status: STATUS_TEXT[t.ticketStatus] || 'Unknown',
    createdOn: t.ticketCreatedOn || '',
  }));

  autoTable(doc, {
    startY: 90,
    head: [columns.map((c) => c.header)],
    body: body.map((r) => columns.map((c) => r[c.dataKey])),
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [10, 37, 64],
      lineColor: [227, 232, 238],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [71, 101, 186],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [246, 249, 252],
    },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.internal.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      const pageWidth  = pageSize.width  || pageSize.getWidth();

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 40,
        pageHeight - 20,
        { align: 'right' }
      );
      doc.text('A2Z Procure — HelpDesk', 40, pageHeight - 20);
    },
  });

  const fileName = buildFileName(meta, 'pdf');
  doc.save(fileName);
}

/* ------------------------------------------------------------
   Shared helpers
   ------------------------------------------------------------ */
function buildFileName(meta, ext) {
  const parts = ['tickets'];
  if (meta.filterLabel) {
    parts.push(meta.filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  }
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join('_')}.${ext}`;
}