"use client";

import { useState } from "react";
import Link from "next/link";

type ExportFormat = "pdf" | "word" | "csv";

const reportTypes = [
  { value: "progress-summary", label: "Progress Summary Report", description: "Comprehensive overview of swimmer development" },
];

const reportIncludes = [
  { key: "proficiency", label: "Proficiency Progress", default: true },
  { key: "milestones", label: "Milestones Achieved", default: true },
  { key: "reflections", label: "Coach Reflections", default: true },
  { key: "sensory", label: "Sensory Profile", default: false },
  { key: "attendance", label: "Attendance Record", default: false },
  { key: "mood", label: "Mood & Regulation Trends", default: false },
];

export default function GenerateReportsPage() {
  const [reportType, setReportType] = useState("progress-summary");
  const [includes, setIncludes] = useState<Record<string, boolean>>(
    Object.fromEntries(reportIncludes.map((r) => [r.key, r.default]))
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<ExportFormat>("pdf");

  const toggleInclude = (key: string) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    // TODO: Generate report via Supabase / API
    alert("Report generation started!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <Link href="/admin/dashboard" className="mb-4 inline-block text-gray-400 hover:text-gray-600">&larr;</Link>
      <h1 className="text-xl font-bold text-gray-800">Generate Reports</h1>
      <p className="mb-6 text-sm text-gray-500">Export swimmer progress and assessment data</p>

      {/* Report Type */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
        >
          {reportTypes.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {reportTypes.find((r) => r.value === reportType)?.description}
        </p>
      </div>

      {/* Report Preview */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Report Preview</h2>
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <div className="text-center text-gray-400">
            <p className="text-3xl mb-1">&#128196;</p>
            <p className="text-sm font-medium">Progress Summary Report</p>
            <p className="text-xs">Preview will appear here</p>
          </div>
        </div>
      </div>

      {/* Include in Report */}
      <div className="mb-6">
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
      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-1 text-sm font-medium text-gray-700">
          &#128197; Date Range (Optional)
        </h2>
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
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Export Format</h2>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: "pdf" as ExportFormat, label: "PDF Document", desc: "Print-ready format" },
            { key: "word" as ExportFormat, label: "Word Document", desc: "Editable format" },
            { key: "csv" as ExportFormat, label: "CSV Export", desc: "Data only" },
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
              <p className="text-lg mb-1">
                {f.key === "pdf" ? "&#128196;" : f.key === "word" ? "&#128462;" : "&#128202;"}
              </p>
              <p className="text-sm font-medium text-gray-800">{f.label}</p>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

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
          className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          &#128202; Generate & Download
        </button>
      </div>
    </div>
  );
}
