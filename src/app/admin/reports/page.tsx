"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, BorderStyle, WidthType, AlignmentType } from "docx";
import { saveAs } from "file-saver";

type ExportFormat = "pdf" | "word" | "csv";

const reportIncludes = [
  { key: "personal", label: "Personal Details", default: true },
  { key: "proficiency", label: "Proficiency Progress", default: true },
  { key: "milestones", label: "Milestones Achieved", default: true },
  { key: "reflections", label: "Coach Reflections", default: true },
  { key: "sensory", label: "Sensory Profile", default: false },
  { key: "attendance", label: "Attendance Record", default: false },
  { key: "mood", label: "Mood & Regulation Trends", default: false },
];

interface Swimmer {
  id: string;
  name: string;
}

interface PersonalDetails {
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  emergency_contact_relationship: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  additional_medical_notes: string | null;
}

interface ReportData {
  swimmer: { name: string; age: number | null; category: string | null; level: number | null };
  personal: PersonalDetails | null;
  skills: { category: string; skill_name: string; status: string }[];
  milestones: { title: string; achieved_on: string; category: string | null; description: string | null }[];
  reflections: { created_at: string; coach_notes: string | null; parent_feedback: string | null; mood: string | null }[];
  sensory: {
    conditions: string[];
    sensory_needs: string | null;
    noise_sensitivity: number | null;
    touch_tolerance: number | null;
    transition_difficulty: number | null;
    communication_preference: string | null;
    known_triggers: string[];
    additional_notes: string | null;
  } | null;
  sessions: { session_date: string; status: string; duration_minutes: number | null }[];
  moods: { date: string; mood: string | null; source: string }[];
  clubName: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatDob(dob: string | null) {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatGender(gender: string | null) {
  if (!gender) return "—";
  const map: Record<string, string> = {
    male: "Male",
    female: "Female",
    non_binary: "Non-binary",
    prefer_not_to_say: "Prefer not to say",
  };
  return map[gender] ?? gender;
}

export default function GenerateReportsPage() {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [selectedSwimmerId, setSelectedSwimmerId] = useState<string>("");
  const [includes, setIncludes] = useState<Record<string, boolean>>(
    Object.fromEntries(reportIncludes.map((r) => [r.key, r.default]))
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>("AquaBridge");

  useEffect(() => {
    fetchSwimmers();
  }, []);

  const fetchSwimmers = async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      const cId = adminProfile?.club_id;
      setClubId(cId);

      if (cId) {
        const { data: club } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", cId)
          .single();
        setClubName(club?.name ?? "AquaBridge");
      }

      const { data: swimmerRows } = await supabase
        .from("swimmers")
        .select("id")
        .eq("club_id", cId);

      const ids = (swimmerRows ?? []).map((s) => s.id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);

      setSwimmers((profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? "Unknown",
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async (): Promise<ReportData | null> => {
    const supabase = createClient();
    const swimmer = swimmers.find((s) => s.id === selectedSwimmerId);
    if (!swimmer) return null;

    const dateFilter = (query: any, column: string) => {
      if (startDate) query = query.gte(column, startDate);
      if (endDate) query = query.lte(column, endDate);
      return query;
    };

    // Swimmer basic info
    const { data: swimmerData } = await supabase
      .from("swimmers")
      .select("age, category, level")
      .eq("id", selectedSwimmerId)
      .single();

    // Personal details
    const { data: personalData } = await supabase
      .from("swimmer_personal_details")
      .select("*")
      .eq("swimmer_id", selectedSwimmerId)
      .single();

    // Skills
    const { data: skills } = await supabase
      .from("skill_progress")
      .select("category, skill_name, status")
      .eq("swimmer_id", selectedSwimmerId);

    // Milestones
    let milestonesQuery = supabase
      .from("milestones")
      .select("title, achieved_on, category, description")
      .eq("swimmer_id", selectedSwimmerId)
      .order("achieved_on", { ascending: false });
    milestonesQuery = dateFilter(milestonesQuery, "achieved_on");
    const { data: milestones } = await milestonesQuery;

    // Reflections
    let reflectionsQuery = supabase
      .from("session_reflections")
      .select("created_at, coach_notes, parent_feedback, mood")
      .eq("swimmer_id", selectedSwimmerId)
      .order("created_at", { ascending: false });
    reflectionsQuery = dateFilter(reflectionsQuery, "created_at");
    const { data: reflections } = await reflectionsQuery;

    // Sensory profile
    const { data: sensory } = await supabase
      .from("swimmer_profiles")
      .select("conditions, sensory_needs, noise_sensitivity, touch_tolerance, transition_difficulty, communication_preference, known_triggers, additional_notes")
      .eq("swimmer_id", selectedSwimmerId)
      .single();

    // Sessions (attendance)
    let sessionsQuery = supabase
      .from("sessions")
      .select("session_date, status, duration_minutes")
      .eq("swimmer_id", selectedSwimmerId)
      .order("session_date", { ascending: false });
    sessionsQuery = dateFilter(sessionsQuery, "session_date");
    const { data: sessions } = await sessionsQuery;

    // Mood trends
    let moodReflQuery = supabase
      .from("session_reflections")
      .select("created_at, mood")
      .eq("swimmer_id", selectedSwimmerId);
    moodReflQuery = dateFilter(moodReflQuery, "created_at");
    const { data: moodRefl } = await moodReflQuery;

    let moodPreQuery = supabase
      .from("pre_session_logs")
      .select("created_at, mood_before")
      .eq("swimmer_id", selectedSwimmerId);
    moodPreQuery = dateFilter(moodPreQuery, "created_at");
    const { data: moodPre } = await moodPreQuery;

    const moods = [
      ...(moodRefl ?? []).map((r) => ({ date: r.created_at, mood: r.mood, source: "Post-session" })),
      ...(moodPre ?? []).map((p) => ({ date: p.created_at, mood: p.mood_before, source: "Pre-session" })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      swimmer: {
        name: swimmer.name,
        age: swimmerData?.age ?? null,
        category: swimmerData?.category ?? null,
        level: swimmerData?.level ?? null,
      },
      personal: personalData ?? null,
      skills: skills ?? [],
      milestones: milestones ?? [],
      reflections: reflections ?? [],
      sensory: sensory ?? null,
      sessions: sessions ?? [],
      moods,
      clubName,
    };
  };

  const generateCSV = (data: ReportData) => {
    const rows: string[][] = [];

    rows.push(["AQUABRIDGE PROGRESS REPORT"]);
    rows.push(["Swimmer", data.swimmer.name]);
    rows.push(["Age", data.swimmer.age?.toString() ?? "—"]);
    rows.push(["Level", data.swimmer.level?.toString() ?? "—"]);
    rows.push(["Category", data.swimmer.category ?? "—"]);
    rows.push(["Generated", new Date().toLocaleDateString()]);
    rows.push([]);

    if (includes.personal && data.personal) {
      rows.push(["PERSONAL DETAILS"]);
      rows.push(["Date of Birth", formatDob(data.personal.date_of_birth)]);
      rows.push(["Gender", formatGender(data.personal.gender)]);
      rows.push(["Address", data.personal.address ?? "—"]);
      rows.push(["Postal Code", data.personal.postal_code ?? "—"]);
      rows.push([]);
      rows.push(["EMERGENCY CONTACT"]);
      rows.push(["Name", data.personal.emergency_contact_name ?? "—"]);
      rows.push(["Number", data.personal.emergency_contact_number ?? "—"]);
      rows.push(["Relationship", data.personal.emergency_contact_relationship ?? "—"]);
      rows.push([]);
      rows.push(["MEDICAL INFORMATION"]);
      rows.push(["Medical Conditions", data.personal.medical_conditions ?? "—"]);
      rows.push(["Allergies", data.personal.allergies ?? "—"]);
      rows.push(["Medications", data.personal.medications ?? "—"]);
      rows.push(["Additional Medical Notes", data.personal.additional_medical_notes ?? "—"]);
      rows.push([]);
    }

    if (includes.proficiency) {
      rows.push(["SKILL PROGRESS"]);
      rows.push(["Category", "Skill", "Status"]);
      data.skills.forEach((s) => rows.push([s.category, s.skill_name, s.status]));
      rows.push([]);
    }

    if (includes.milestones) {
      rows.push(["MILESTONES"]);
      rows.push(["Title", "Date", "Category", "Description"]);
      data.milestones.forEach((m) => rows.push([m.title, formatDate(m.achieved_on), m.category ?? "—", m.description ?? "—"]));
      rows.push([]);
    }

    if (includes.reflections) {
      rows.push(["REFLECTIONS"]);
      rows.push(["Date", "Coach Notes", "Parent Feedback", "Mood"]);
      data.reflections.forEach((r) => rows.push([formatDate(r.created_at), r.coach_notes ?? "—", r.parent_feedback ?? "—", r.mood ?? "—"]));
      rows.push([]);
    }

    if (includes.sensory && data.sensory) {
      rows.push(["SENSORY PROFILE"]);
      rows.push(["Conditions", (data.sensory.conditions ?? []).join(", ")]);
      rows.push(["Noise Sensitivity", data.sensory.noise_sensitivity?.toString() ?? "—"]);
      rows.push(["Touch Tolerance", data.sensory.touch_tolerance?.toString() ?? "—"]);
      rows.push(["Transition Difficulty", data.sensory.transition_difficulty?.toString() ?? "—"]);
      rows.push(["Communication Preference", data.sensory.communication_preference ?? "—"]);
      rows.push(["Known Triggers", (data.sensory.known_triggers ?? []).join(", ")]);
      rows.push([]);
    }

    if (includes.attendance) {
      rows.push(["ATTENDANCE"]);
      rows.push(["Date", "Status", "Duration (mins)"]);
      data.sessions.forEach((s) => rows.push([formatDate(s.session_date), s.status, s.duration_minutes?.toString() ?? "—"]));
      rows.push([]);
    }

    if (includes.mood) {
      rows.push(["MOOD TRENDS"]);
      rows.push(["Date", "Mood", "Source"]);
      data.moods.forEach((m) => rows.push([formatDate(m.date), m.mood ?? "—", m.source]));
    }

    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, `${data.swimmer.name}_report.csv`);
  };

  const generatePDF = (data: ReportData) => {
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(13, 148, 136);
    doc.text("AquaBridge", 105, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text("Swimmer Progress Report", 105, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, y, { align: "center" });
    y += 10;

    // Swimmer info box
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(14, y, 182, 24, 3, 3, "F");
    doc.setFontSize(13);
    doc.setTextColor(31, 41, 55);
    doc.text(data.swimmer.name, 20, y + 8);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Age: ${data.swimmer.age ?? "—"} | Level: ${data.swimmer.level ?? "—"} | Category: ${data.swimmer.category ?? "—"}`, 20, y + 16);
    y += 32;

    const addSection = (title: string) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(13, 148, 136);
      doc.text(title, 14, y);
      y += 2;
      doc.setDrawColor(13, 148, 136);
      doc.line(14, y, 196, y);
      y += 6;
    };

    // Personal Details
    if (includes.personal && data.personal) {
      addSection("Personal Details");
      autoTable(doc, {
        startY: y,
        body: [
          ["Date of Birth", formatDob(data.personal.date_of_birth)],
          ["Gender", formatGender(data.personal.gender)],
          ["Address", `${data.personal.address ?? "—"}${data.personal.postal_code ? ` S(${data.personal.postal_code})` : ""}`],
        ],
        theme: "striped",
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      addSection("Emergency Contact");
      autoTable(doc, {
        startY: y,
        body: [
          ["Name", data.personal.emergency_contact_name ?? "—"],
          ["Number", data.personal.emergency_contact_number ?? "—"],
          ["Relationship", data.personal.emergency_contact_relationship ?? "—"],
        ],
        theme: "striped",
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      addSection("Medical Information");
      autoTable(doc, {
        startY: y,
        body: [
          ["Medical Conditions", data.personal.medical_conditions ?? "—"],
          ["Allergies", data.personal.allergies ?? "—"],
          ["Medications", data.personal.medications ?? "—"],
          ["Additional Notes", data.personal.additional_medical_notes ?? "—"],
        ],
        theme: "striped",
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Skills
    if (includes.proficiency && data.skills.length > 0) {
      addSection("Skill Progress");
      const grouped: Record<string, typeof data.skills> = {};
      data.skills.forEach((s) => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s);
      });
      Object.entries(grouped).forEach(([cat, skills]) => {
        autoTable(doc, {
          startY: y,
          head: [[cat, "Status"]],
          body: skills.map((s) => [s.skill_name, s.status]),
          theme: "striped",
          headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      });
    }

    // Milestones
    if (includes.milestones && data.milestones.length > 0) {
      addSection("Milestones Achieved");
      autoTable(doc, {
        startY: y,
        head: [["Title", "Date", "Category"]],
        body: data.milestones.map((m) => [m.title, formatDate(m.achieved_on), m.category ?? "—"]),
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Reflections
    if (includes.reflections && data.reflections.length > 0) {
      addSection("Coach Reflections");
      autoTable(doc, {
        startY: y,
        head: [["Date", "Coach Notes", "Parent Feedback", "Mood"]],
        body: data.reflections.map((r) => [
          formatDate(r.created_at),
          r.coach_notes ?? "—",
          r.parent_feedback ?? "—",
          r.mood ?? "—",
        ]),
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { cellWidth: 55 }, 2: { cellWidth: 55 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Sensory
    if (includes.sensory && data.sensory) {
      addSection("Sensory Profile");
      autoTable(doc, {
        startY: y,
        body: [
          ["Conditions", (data.sensory.conditions ?? []).join(", ") || "—"],
          ["Noise Sensitivity", `${data.sensory.noise_sensitivity ?? "—"}/10`],
          ["Touch Tolerance", `${data.sensory.touch_tolerance ?? "—"}/10`],
          ["Transition Difficulty", `${data.sensory.transition_difficulty ?? "—"}/10`],
          ["Communication Preference", data.sensory.communication_preference ?? "—"],
          ["Known Triggers", (data.sensory.known_triggers ?? []).join(", ") || "—"],
          ["Additional Notes", data.sensory.additional_notes ?? "—"],
        ],
        theme: "striped",
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Attendance
    if (includes.attendance && data.sessions.length > 0) {
      addSection("Attendance Record");
      const completed = data.sessions.filter((s) => s.status === "completed").length;
      const cancelled = data.sessions.filter((s) => s.status === "cancelled").length;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Status", "Duration (mins)"]],
        body: [
          ...data.sessions.map((s) => [formatDate(s.session_date), s.status, s.duration_minutes?.toString() ?? "—"]),
          ["", `Completed: ${completed} | Cancelled: ${cancelled}`, ""],
        ],
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Mood
    if (includes.mood && data.moods.length > 0) {
      addSection("Mood & Regulation Trends");
      autoTable(doc, {
        startY: y,
        head: [["Date", "Mood", "Source"]],
        body: data.moods.map((m) => [formatDate(m.date), m.mood ?? "—", m.source]),
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`${data.swimmer.name}_report.pdf`);
  };

  const generateWord = async (data: ReportData) => {
    const sectionHeading = (text: string) =>
      new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      });

    const tableFromRows = (headers: string[], rows: string[][]) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: headers.map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
                  shading: { fill: "0D9488" },
                })
            ),
          }),
          ...rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
                    })
                ),
              })
          ),
        ],
      });

    const children: any[] = [
      new Paragraph({
        text: "AquaBridge",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: "Swimmer Progress Report",
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({ text: `Swimmer: ${data.swimmer.name}`, spacing: { after: 50 } }),
      new Paragraph({ text: `Age: ${data.swimmer.age ?? "—"}`, spacing: { after: 50 } }),
      new Paragraph({ text: `Level: ${data.swimmer.level ?? "—"}`, spacing: { after: 50 } }),
      new Paragraph({ text: `Category: ${data.swimmer.category ?? "—"}`, spacing: { after: 50 } }),
      new Paragraph({ text: `Generated: ${new Date().toLocaleDateString()}`, spacing: { after: 300 } }),
    ];

    if (includes.personal && data.personal) {
      children.push(sectionHeading("Personal Details"));
      children.push(tableFromRows(
        ["Field", "Value"],
        [
          ["Date of Birth", formatDob(data.personal.date_of_birth)],
          ["Gender", formatGender(data.personal.gender)],
          ["Address", `${data.personal.address ?? "—"}${data.personal.postal_code ? ` S(${data.personal.postal_code})` : ""}`],
        ]
      ));

      children.push(sectionHeading("Emergency Contact"));
      children.push(tableFromRows(
        ["Field", "Value"],
        [
          ["Name", data.personal.emergency_contact_name ?? "—"],
          ["Number", data.personal.emergency_contact_number ?? "—"],
          ["Relationship", data.personal.emergency_contact_relationship ?? "—"],
        ]
      ));

      children.push(sectionHeading("Medical Information"));
      children.push(tableFromRows(
        ["Field", "Value"],
        [
          ["Medical Conditions", data.personal.medical_conditions ?? "—"],
          ["Allergies", data.personal.allergies ?? "—"],
          ["Medications", data.personal.medications ?? "—"],
          ["Additional Notes", data.personal.additional_medical_notes ?? "—"],
        ]
      ));
    }

    if (includes.proficiency && data.skills.length > 0) {
      children.push(sectionHeading("Skill Progress"));
      const grouped: Record<string, typeof data.skills> = {};
      data.skills.forEach((s) => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s);
      });
      Object.entries(grouped).forEach(([cat, skills]) => {
        children.push(new Paragraph({ text: cat, spacing: { before: 100, after: 50 } }));
        children.push(tableFromRows(["Skill", "Status"], skills.map((s) => [s.skill_name, s.status])));
      });
    }

    if (includes.milestones && data.milestones.length > 0) {
      children.push(sectionHeading("Milestones Achieved"));
      children.push(tableFromRows(
        ["Title", "Date", "Category"],
        data.milestones.map((m) => [m.title, formatDate(m.achieved_on), m.category ?? "—"])
      ));
    }

    if (includes.reflections && data.reflections.length > 0) {
      children.push(sectionHeading("Coach Reflections"));
      children.push(tableFromRows(
        ["Date", "Coach Notes", "Parent Feedback", "Mood"],
        data.reflections.map((r) => [formatDate(r.created_at), r.coach_notes ?? "—", r.parent_feedback ?? "—", r.mood ?? "—"])
      ));
    }

    if (includes.sensory && data.sensory) {
      children.push(sectionHeading("Sensory Profile"));
      children.push(tableFromRows(
        ["Field", "Value"],
        [
          ["Conditions", (data.sensory.conditions ?? []).join(", ") || "—"],
          ["Noise Sensitivity", `${data.sensory.noise_sensitivity ?? "—"}/10`],
          ["Touch Tolerance", `${data.sensory.touch_tolerance ?? "—"}/10`],
          ["Transition Difficulty", `${data.sensory.transition_difficulty ?? "—"}/10`],
          ["Communication Preference", data.sensory.communication_preference ?? "—"],
          ["Known Triggers", (data.sensory.known_triggers ?? []).join(", ") || "—"],
          ["Additional Notes", data.sensory.additional_notes ?? "—"],
        ]
      ));
    }

    if (includes.attendance && data.sessions.length > 0) {
      children.push(sectionHeading("Attendance Record"));
      const completed = data.sessions.filter((s) => s.status === "completed").length;
      const cancelled = data.sessions.filter((s) => s.status === "cancelled").length;
      children.push(new Paragraph({ text: `Completed: ${completed} | Cancelled: ${cancelled}`, spacing: { after: 100 } }));
      children.push(tableFromRows(
        ["Date", "Status", "Duration (mins)"],
        data.sessions.map((s) => [formatDate(s.session_date), s.status, s.duration_minutes?.toString() ?? "—"])
      ));
    }

    if (includes.mood && data.moods.length > 0) {
      children.push(sectionHeading("Mood & Regulation Trends"));
      children.push(tableFromRows(
        ["Date", "Mood", "Source"],
        data.moods.map((m) => [formatDate(m.date), m.mood ?? "—", m.source])
      ));
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${data.swimmer.name}_report.docx`);
  };

  const handleGenerate = async () => {
    if (!selectedSwimmerId) {
      setError("Please select a swimmer.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const data = await fetchReportData();
      if (!data) throw new Error("Failed to fetch report data.");

      if (format === "csv") generateCSV(data);
      else if (format === "pdf") generatePDF(data);
      else if (format === "word") await generateWord(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleInclude = (key: string) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <h1 className="text-xl font-bold text-gray-800">Generate Reports</h1>
        <p className="mb-6 text-sm text-gray-500">Export swimmer progress and assessment data</p>

        {/* Swimmer Selection */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">Select Swimmer</label>
          {loading ? (
            <p className="text-sm text-gray-500">Loading swimmers...</p>
          ) : (
            <select
              value={selectedSwimmerId}
              onChange={(e) => setSelectedSwimmerId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            >
              <option value="">-- Select a swimmer --</option>
              {swimmers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Include in Report */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Include in Report</h2>
          <div className="space-y-2">
            {reportIncludes.map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includes[item.key]}
                  onChange={() => toggleInclude(item.key)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">&#128197; Date Range (Optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Export Format */}
        <div className="mb-8 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Export Format</h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "pdf" as ExportFormat, label: "PDF", desc: "Print-ready", icon: "&#128196;" },
              { key: "word" as ExportFormat, label: "Word", desc: "Editable", icon: "&#128221;" },
              { key: "csv" as ExportFormat, label: "CSV", desc: "Data only", icon: "&#128202;" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={`rounded-xl border-2 p-4 text-center transition ${
                  format === f.key
                    ? "border-teal-500 bg-teal-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="text-lg mb-1" dangerouslySetInnerHTML={{ __html: f.icon }} />
                <p className="text-sm font-medium text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/admin/dashboard"
            className="flex-1 rounded-lg border border-gray-200 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedSwimmerId}
            className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
          >
            {generating ? "Generating..." : "&#128202; Generate & Download"}
          </button>
        </div>
      </div>
    </div>
  );
}