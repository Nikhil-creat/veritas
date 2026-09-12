"use client";

// Builds a shareable "evidence report" PDF from an analysis result.
// Runs entirely client-side (jsPDF) — no server round-trip, no data
// leaves the browser beyond the analysis call that already happened.

export async function downloadEvidenceReport(result, meta) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Veritas — Content Authenticity Report", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString()} · Subject: ${meta.label}`, margin, y);
  y += 24;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(`${result.score} / 100`, margin, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`trust score  ·  ${result.confidence} confidence`, margin + 140, y - 2);
  y += 26;

  doc.setFontSize(11);
  const summaryLines = doc.splitTextToSize(result.summary, pageWidth - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 20;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Evidence checked", margin, y);
  y += 20;

  const verdictLabel = { clear: "CLEAR", caution: "CAUTION", flagged: "FLAGGED" };

  result.signals.forEach((signal) => {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`[${verdictLabel[signal.verdict] || signal.verdict.toUpperCase()}]  ${signal.title}`, margin, y);
    y += 15;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    const detailLines = doc.splitTextToSize(signal.detail, pageWidth - margin * 2);
    doc.text(detailLines, margin, y);
    y += detailLines.length * 12 + 16;
  });

  if (result.fingerprint) {
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`Perceptual fingerprint: ${result.fingerprint}`, margin, y);
    y += 16;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140);
  const disclaimer =
    "This report reflects heuristic, explainable signals — not forensic certification. Each signal is individually beatable; the score exists to summarize, not replace, the evidence above.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(disclaimerLines, margin, y);

  doc.save(`veritas-report-${Date.now()}.pdf`);
}
