// src/services/pdfExportService.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task } from '../types/task';
import { format } from 'date-fns';

export interface TaskExportData {
  task: Task;
  subtasks?: any[];
  notes?: any[];
  attachments?: any[];
  assignments?: any[];
  history?: any[];
  timeSpentSeconds?: number;
  totalDurationSeconds?: number;
  commentsCount?: number;
  companyName?: string;
}

export function exportTaskToPdf({
  task,
  subtasks = [],
  notes = [],
  assignments = [],
  history = [],
  timeSpentSeconds = 0,
  totalDurationSeconds = 0,
  companyName = 'TASKER Enterprise',
}: TaskExportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary Colors (Enterprise Navy & Indigo)
  const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
  const accentColor: [number, number, number] = [37, 99, 235]; // blue-600
  const mutedColor: [number, number, number] = [100, 116, 139]; // slate-500

  // 1. Top Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Accent highlight bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName, 15, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('ENTERPRISE WORK ORDER & AUDIT REPORT', 15, 20);

  // Document Info (Right side)
  doc.setFontSize(8);
  doc.text(`DOC REF: WO-${task.id.slice(0, 8).toUpperCase()}`, pageWidth - 15, 12, { align: 'right' });
  doc.text(`ISSUED: ${format(new Date(), 'PPpp')}`, pageWidth - 15, 18, { align: 'right' });

  // 2. Task Core Details Section
  let y = 38;
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(task.title, 15, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  const statusLabel = (task.status || 'PENDING').toUpperCase().replace('_', ' ');
  const priorityLabel = (task.priority || 'MEDIUM').toUpperCase();
  const categoryLabel = ((task as any).category || 'General').toUpperCase();
  doc.text(`STATUS: ${statusLabel}   |   PRIORITY: ${priorityLabel}   |   CATEGORY: ${categoryLabel}`, 15, y);

  y += 8;
  // Metadata Table
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const effectiveDuration = totalDurationSeconds || timeSpentSeconds;

  const metaRows = [
    [
      { content: 'Assigned Operative:', styles: { fontStyle: 'bold' as const } },
      task.assigned_to_name || (task as any).assigned_to_email || 'Unassigned',
      { content: 'Assigned Date:', styles: { fontStyle: 'bold' as const } },
      task.created_at ? format(new Date(task.created_at), 'PPP') : 'N/A',
    ],
    [
      { content: 'Delegated / Created By:', styles: { fontStyle: 'bold' as const } },
      (task as any).delegated_by_name || task.created_by || 'System Admin',
      { content: 'Due Date:', styles: { fontStyle: 'bold' as const } },
      task.due_date ? format(new Date(task.due_date), 'PPP') : 'No Deadline',
    ],
    [
      { content: 'Subtasks Total:', styles: { fontStyle: 'bold' as const } },
      `${subtasks.filter((s) => s.is_completed).length} / ${subtasks.length} Completed`,
      { content: 'Recorded Duration:', styles: { fontStyle: 'bold' as const } },
      effectiveDuration > 0 ? formatTime(effectiveDuration) : 'Untracked',
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: metaRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 42, fillColor: [248, 250, 252] },
      1: { cellWidth: 50 },
      2: { cellWidth: 38, fillColor: [248, 250, 252] },
      3: { cellWidth: 50 },
    },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // 3. Description / Scope of Work
  if (task.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('SCOPE OF WORK / INSTRUCTIONS', 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitDesc = doc.splitTextToSize(task.description, pageWidth - 30);
    doc.text(splitDesc, 15, y);
    y += splitDesc.length * 4.5 + 6;
  }

  // 4. Subtasks Checklist Table
  if (subtasks.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('SUBTASK VERIFICATION & LOGBOOK', 15, y);
    y += 4;

    const subtaskTableData = subtasks.map((st, idx) => [
      String(idx + 1),
      st.title,
      st.assigned_to_name || 'Self',
      st.is_completed ? 'COMPLETED' : 'PENDING',
      st.completed_at ? format(new Date(st.completed_at), 'PP p') : '-',
      st.proof_data?.type ? `Proof: ${st.proof_data.type.toUpperCase()}` : 'No Proof',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Subtask / Item', 'Assigned', 'Status', 'Completed Timestamp', 'Verification']],
      body: subtaskTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 28 },
        3: { cellWidth: 24, fontStyle: 'bold' },
        4: { cellWidth: 34 },
        5: { cellWidth: 26 },
      },
      didParseCell: function (data) {
        if (data.column.index === 3 && data.cell.section === 'body') {
          if (data.cell.raw === 'COMPLETED') {
            data.cell.styles.textColor = [16, 149, 193]; // green / emerald
          } else {
            data.cell.styles.textColor = [234, 88, 12]; // orange
          }
        }
      },
      margin: { left: 15, right: 15 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Activity Notes & Remarks
  if (notes && notes.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 25;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('ACTIVITY LOG & REMARKS', 15, y);
    y += 4;

    const noteRows = notes.slice(0, 5).map((n: any) => [
      n.created_at ? format(new Date(n.created_at), 'PP p') : '-',
      n.user_name || 'System User',
      n.content || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'Author', 'Remark / Note']],
      body: noteRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 }, 2: { cellWidth: pageWidth - 100 } },
      margin: { left: 15, right: 15 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Check audit count summary
  const auditSummaryText = `Audit Events Logged: ${history.length} status transitions, ${assignments.length} assignments.`;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedColor);
  doc.text(auditSummaryText, 15, y);
  y += 6;

  // Check if enough space for signatures, otherwise new page
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 25;
  }

  // 5. Verification & Sign-off Block
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);

  // Operative Sign box
  const boxWidth = (pageWidth - 40) / 2;
  doc.line(15, y + 16, 15 + boxWidth, y + 16);
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('OPERATIVE SIGNATURE & DATE', 15, y + 21);
  doc.setFontSize(7.5);
  doc.text(`Name: ${task.assigned_to_name || 'Operative'}`, 15, y + 25);

  // Supervisor Sign box
  doc.line(pageWidth - 15 - boxWidth, y + 16, pageWidth - 15, y + 16);
  doc.setFontSize(8);
  doc.text('SUPERVISOR / CLIENT SIGN-OFF', pageWidth - 15 - boxWidth, y + 21);
  doc.setFontSize(7.5);
  doc.text('Signature / Stamp: Verified & Approved', pageWidth - 15 - boxWidth, y + 25);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedColor);
    doc.text(
      `TASKER Operations Platform  •  Document generated electronically  •  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Download PDF
  const cleanTitle = task.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  doc.save(`TASKER_WorkOrder_${cleanTitle}_v1.0.21.pdf`);
}
