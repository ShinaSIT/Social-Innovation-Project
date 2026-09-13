"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type CertStatus = "not_submitted" | "pending" | "verified" | "rejected";

interface CertData {
  cert_status: CertStatus;
  cert_number: string | null;
  cert_body: string | null;
  cert_expiry: string | null;
  cert_file_url: string | null;
}

export default function CertificationPage() {
  const [certData, setCertData] = useState<CertData | null>(null);
  const [certNumber, setCertNumber] = useState("");
  const [certBody, setCertBody] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("coaches")
        .select("cert_status, cert_number, cert_body, cert_expiry, cert_file_url")
        .eq("id", user!.id)
        .single();
      if (data) {
        setCertData(data as CertData);
        setCertNumber(data.cert_number ?? "");
        setCertBody(data.cert_body ?? "");
        setCertExpiry(data.cert_expiry ?? "");
      }
    }
    load();
  }, []);

  const handleSubmit = async () => {
    if (!certNumber.trim() || !certBody.trim()) {
      setError("Please fill in your certification number and issuing body.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let fileUrl = certData?.cert_file_url ?? null;

    // Upload cert file to Supabase Storage if provided
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `certifications/${user!.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("coach-certs")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        setError("File upload failed: " + uploadError.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("coach-certs").getPublicUrl(path);
      fileUrl = urlData.publicUrl;
    }

    await supabase
      .from("coaches")
      .update({
        cert_number: certNumber,
        cert_body: certBody,
        cert_expiry: certExpiry || null,
        cert_file_url: fileUrl,
        cert_status: "pending",
      })
      .eq("id", user!.id);

    setSubmitted(true);
    setSaving(false);
  };

  const status = certData?.cert_status ?? "not_submitted";

  const statusBanner: Record<CertStatus, { bg: string; text: string; message: string }> = {
    not_submitted: { bg: "bg-gray-50 border-gray-200", text: "text-gray-700", message: "Submit your coaching certification to unlock student management." },
    pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", message: "Your certification is under review. This usually takes 1–2 business days." },
    verified: { bg: "bg-teal-50 border-teal-200", text: "text-teal-800", message: "Your certification has been verified. You can now add and manage students." },
    rejected: { bg: "bg-red-50 border-red-200", text: "text-red-800", message: "Your certification was not approved. Please check the details and resubmit." },
  };

  const banner = statusBanner[submitted ? "pending" : status];

  return (
    <div className="min-h-screen page-shell-narrow bg-gray-50 p-6 pb-12">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/coach/students" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h1 className="text-xl font-bold text-gray-800">Coaching Certification</h1>
      </div>

      {/* Status banner */}
      <div className={`mb-6 rounded-xl border p-4 ${banner.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">
            {(submitted ? "pending" : status) === "verified" ? "✅" :
             (submitted ? "pending" : status) === "rejected" ? "❌" :
             (submitted ? "pending" : status) === "pending" ? "⏳" : "📋"}
          </span>
          <p className={`text-sm font-semibold capitalize ${banner.text}`}>
            {submitted ? "Pending Review" : status.replace("_", " ")}
          </p>
        </div>
        <p className={`text-sm ${banner.text}`}>{banner.message}</p>
      </div>

      {/* Show form if not verified */}
      {status !== "verified" && !submitted && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800">Certification Details</h2>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Certification Number *</label>
              <input
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="e.g. SSC-2024-XXXXX"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Issuing Body *</label>
              <input
                value={certBody}
                onChange={(e) => setCertBody(e.target.value)}
                placeholder="e.g. Singapore Sports Council, SwimSafer..."
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Expiry Date</label>
              <input
                type="date"
                value={certExpiry}
                onChange={(e) => setCertExpiry(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Upload Certificate (PDF or image)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:text-teal-700 hover:file:bg-teal-100"
              />
              <p className="mt-1 text-xs text-gray-400">Max 5MB. Accepted: PDF, JPG, PNG.</p>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
          >
            {saving ? "Submitting…" : status === "rejected" ? "Re-submit Certification" : "Submit for Review"}
          </button>
        </div>
      )}

      {/* Already verified — show current cert details */}
      {status === "verified" && certData && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800">Your Verified Certification</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="text-gray-500">Number:</span> {certData.cert_number}</p>
            <p><span className="text-gray-500">Issuing Body:</span> {certData.cert_body}</p>
            {certData.cert_expiry && (
              <p><span className="text-gray-500">Expires:</span> {new Date(certData.cert_expiry).toLocaleDateString("en-SG")}</p>
            )}
          </div>
          {certData.cert_file_url && (
            <a
              href={certData.cert_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-teal-600 hover:underline"
            >
              View uploaded certificate ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
