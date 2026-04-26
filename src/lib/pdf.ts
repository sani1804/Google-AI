import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { SummaryReport, ChatMessage, InterviewConfig } from "./gemini";

export const generatePDFReport = (
  report: SummaryReport,
  messages: ChatMessage[],
  config: InterviewConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(29, 36, 51); // #1d2433
  doc.text("PrepAI - Interview Report", margin, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 27);

  // Job Info
  doc.setDrawColor(203, 133, 90); // #cb855a
  doc.setLineWidth(2);
  doc.line(margin, 32, margin + 20, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(29, 36, 51);
  doc.text("Position Details", margin, 42);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Role:", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.text(config.jobTitle || "Not Specified", margin + 15, 50);

  doc.setFont("helvetica", "bold");
  doc.text("Company:", margin, 55);
  doc.setFont("helvetica", "normal");
  doc.text(config.companyName || "Not Specified", margin + 25, 55);

  doc.setFont("helvetica", "bold");
  doc.text("Mode:", margin, 60);
  doc.setFont("helvetica", "normal");
  const modeLabel = config.mode === 'auto-simulate' ? 'Agentic Simulation' : config.mode === 'feedback' ? 'Interview with Live Feedback' : 'Simulation';
  doc.text(modeLabel, margin + 18, 60);

  // Overall Score
  doc.setDrawColor(29, 36, 51, 0.1);
  doc.setLineWidth(0.1);
  doc.roundedRect(pageWidth - 60, 35, 40, 30, 5, 5);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("OVERALL SCORE", pageWidth - 55, 45);
  
  doc.setFontSize(24);
  doc.setTextColor(203, 133, 90);
  doc.text(`${report.overallScore}`, pageWidth - 47, 58);

  // Summary reasoning
  let currentY = 75;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(29, 36, 51);
  doc.text("Analysis Summary", margin, currentY);
  
  currentY += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const reasoning = doc.splitTextToSize(report.scoringReasoning, pageWidth - (margin * 2));
  doc.text(reasoning, margin, currentY);
  currentY += (reasoning.length * 5) + 10;

  // Strengths & Improvements
  const tableData = [];
  const maxLen = Math.max(report.strengths.length, report.improvements.length);
  for (let i = 0; i < maxLen; i++) {
    tableData.push([
      report.strengths[i] ? `• ${report.strengths[i]}` : "",
      report.improvements[i] ? `• ${report.improvements[i]}` : ""
    ]);
  }

  (doc as any).autoTable({
    startY: currentY,
    head: [['Key Strengths', 'Areas for Improvement']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [29, 36, 51], textColor: [255, 255, 255] },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Executive Summary
  if (report.executiveSummary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Executive Summary", margin, currentY);
    currentY += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const execSum = doc.splitTextToSize(report.executiveSummary, pageWidth - (margin * 2));
    doc.text(execSum, margin, currentY);
    currentY += (execSum.length * 5) + 10;
  }

  // Technical Assessment
  if (report.technicalAssessment) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Technical Assessment", margin, currentY);
    currentY += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const techAs = doc.splitTextToSize(report.technicalAssessment, pageWidth - (margin * 2));
    doc.text(techAs, margin, currentY);
    currentY += (techAs.length * 5) + 10;
  }

  // Behavioral Assessment
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Behavioral Assessment", margin, currentY);
  currentY += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const behavioral = doc.splitTextToSize(report.behavioralAssessment, pageWidth - (margin * 2));
  doc.text(behavioral, margin, currentY);
  currentY += (behavioral.length * 5) + 10;

  doc.setFont("helvetica", "bold");
  doc.text("Language Proficiency", margin, currentY);
  currentY += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lang = doc.splitTextToSize(report.languageProficiency, pageWidth - (margin * 2));
  doc.text(lang, margin, currentY);
  currentY += (lang.length * 5) + 15;

  // Full Transcript Section
  doc.addPage();
  currentY = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Interview Transcript", margin, currentY);
  currentY += 10;

  messages.forEach((msg) => {
    const roleLabel = msg.role === 'user' ? 'Candidate: ' : 'Interviewer: ';
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(msg.role === 'user' ? 203 : 29, msg.role === 'user' ? 133 : 36, msg.role === 'user' ? 90 : 51);
    doc.text(roleLabel, margin, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const text = doc.splitTextToSize(msg.text, pageWidth - (margin * 2) - 25);
    doc.text(text, margin + 25, currentY);
    
    currentY += (text.length * 4) + 6;
    
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
  });

  // Ideal Answers if available
  if (report.idealAnswers && report.idealAnswers.length > 0) {
    doc.addPage();
    currentY = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Ideal Answers Reference", margin, currentY);
    currentY += 10;

    report.idealAnswers.forEach((item, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(29, 36, 51);
      doc.text(`Q: ${item.question}`, margin, currentY);
      currentY += 6;
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 100, 0); // Dark Green
      const ideal = doc.splitTextToSize(`Ideal Answer: ${item.answer}`, pageWidth - (margin * 2));
      doc.text(ideal, margin, currentY);
      
      currentY += (ideal.length * 4) + 10;

      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });
  }

  doc.save(`PrepAI_Report_${config.jobTitle.replace(/\s+/g, '_')}.pdf`);
};
