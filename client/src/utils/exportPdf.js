import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseJson, toPercentScore } from './scoring';

const CATEGORY_LABELS = {
  contact_info: 'Contact Info',
  formatting_and_ordering: 'Formatting & Ordering',
  quantifiable_metrics: 'Quantifiable Metrics',
  action_verbs: 'Action Verbs',
  keyword_density: 'Keyword Density',
};

const ACCENT_RGB = [145, 132, 217];

/** Renders a resume's ATS report as a downloadable PDF (score, category
 * breakdown, feedback, AI analysis, extracted skills, company rankings). */
export const exportAtsReportPdf = (resume) => {
  if (!resume) return;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  let y = 50;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  const writeParagraph = (text, fontSize = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      ensureSpace(16);
      doc.text(line, marginX, y);
      y += fontSize + 4;
    });
  };

  const writeSectionHeading = (title) => {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(title, marginX, y);
    y += 18;
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text('ATS Score Report', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, marginX, y);
  y += 26;

  // Candidate
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(resume.name || 'Candidate', marginX, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90);
  doc.text(resume.email || '', marginX, y);
  y += 28;

  // Score
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text(`${resume.ats_score ?? '—'}`, marginX, y);
  const scoreWidth = doc.getTextWidth(`${resume.ats_score ?? '—'}`);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('/ 100 ATS', marginX + scoreWidth + 8, y);
  y += 30;

  // Category breakdown
  const breakdown = resume.ats_breakdown || {};
  const breakdownRows = Object.entries(CATEGORY_LABELS).map(([key, label]) => [
    label,
    breakdown[key] != null ? String(breakdown[key]) : '—',
  ]);
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Score']],
    body: breakdownRows,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 10, textColor: 30 },
    headStyles: { fillColor: ACCENT_RGB, textColor: 255 },
  });
  y = doc.lastAutoTable.finalY + 24;

  // Feedback
  const feedback = parseJson(resume.ats_feedback);
  if (feedback.length) {
    writeSectionHeading('Feedback');
    feedback.forEach((f) => writeParagraph(`•  ${f}`));
    y += 8;
  }

  // AI analysis / gap analysis
  if (resume.ats_gap_analysis) {
    writeSectionHeading('AI Analysis');
    writeParagraph(resume.ats_gap_analysis);
    y += 8;
  }

  // Skills
  const skills = parseJson(resume.skills)
    .map((s) => (typeof s === 'object' ? s.name : s))
    .filter(Boolean);
  if (skills.length) {
    writeSectionHeading('Extracted Skills');
    writeParagraph(skills.join(', '));
    y += 8;
  }

  // Company rankings
  const rankings = [...parseJson(resume.rankings)].sort(
    (a, b) => toPercentScore(b.score) - toPercentScore(a.score)
  );
  if (rankings.length) {
    ensureSpace(60);
    writeSectionHeading('Company Match Ranking');
    const rankingRows = rankings.map((r) => {
      const name = r.companyName || (typeof r.company === 'object' ? r.company?.name : r.company) || '—';
      const score = Math.round(toPercentScore(r.score));
      const blocker = r.eligible ? '—' : (r.eligibility_reasons?.[0] || 'Missing criteria');
      return [name, `${score}%`, r.eligible ? 'Eligible' : 'Blocked', blocker];
    });
    autoTable(doc, {
      startY: y,
      head: [['Company', 'Match', 'Status', 'Blocker']],
      body: rankingRows,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9, textColor: 30 },
      headStyles: { fillColor: ACCENT_RGB, textColor: 255 },
    });
  }

  doc.save(`${(resume.name || 'resume').replace(/\s+/g, '_')}_ATS_Report.pdf`);
};
