"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";

interface CoachProfile {
  id: string;
  full_name: string | null;
  bio: string | null;
  specialization: string | null;
  years_experience: number | null;
  coach_type: "club" | "independent";
  hire_date: string | null;
  is_active: boolean;
  cert_status: "not_submitted" | "pending" | "verified" | "rejected";
  cert_number: string | null;
  cert_body: string | null;
  cert_expiry: string | null;
  cert_file_url: string | null;
  club_name: string | null;
  total_students: number;
  total_sessions: number;
}

interface EditForm {
  full_name: string;
  bio: string;
  specialization: string;
  years_experience: string;
  coach_type: "club" | "independent";
  cert_number: string;
  cert_body: string;
  cert_expiry: string;
}

function CertStatusBadge({ status }: { status: CoachProfile["cert_status"] }) {
  const styles = {
    not_submitted: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
    verified: "bg-teal-100 text-teal-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labels = {
    not_submitted: "Not Submitted",
    pending: "Pending Review",
    verified: "Verified",
    rejected: "Rejected",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function CoachProfilePage() {
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      // Fetch profile and coach data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, club_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw new Error("Failed to load profile.");

      const { data: coachData, error: coachError } = await supabase
        .from("coaches")
        .select("bio, specialization, years_experience, coach_type, hire_date, is_active, cert_status, cert_number, cert_body, cert_expiry, cert_file_url")
        .eq("id", user.id)
        .single();

      if (coachError) throw new Error("Failed to load coach data.");

      // Fetch club name
      let club_name = null;
      if (profileData.club_id) {
        const { data: clubData } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", profileData.club_id)
          .single();
        club_name = clubData?.name ?? null;
      }

      // Fetch total assigned students
      const { count: studentCount } = await supabase
        .from("coach_students")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", user.id);

      // Fetch total completed sessions
      const { count: sessionCount } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", user.id)
        .eq("status", "completed");

      const fullProfile: CoachProfile = {
        id: user.id,
        full_name: profileData.full_name,
        bio: coachData.bio,
        specialization: coachData.specialization,
        years_experience: coachData.years_experience,
        coach_type: coachData.coach_type,
        hire_date: coachData.hire_date,
        is_active: coachData.is_active,
        cert_status: coachData.cert_status,
        cert_number: coachData.cert_number,
        cert_body: coachData.cert_body,
        cert_expiry: coachData.cert_expiry,
        cert_file_url: coachData.cert_file_url,
        club_name,
        total_students: studentCount ?? 0,
        total_sessions: sessionCount ?? 0,
      };

      setProfile(fullProfile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (!profile) return;
    setEditForm({
      full_name: profile.full_name ?? "",
      bio: profile.bio ?? "",
      specialization: profile.specialization ?? "",
      years_experience: profile.years_experience?.toString() ?? "",
      coach_type: profile.coach_type,
      cert_number: profile.cert_number ?? "",
      cert_body: profile.cert_body ?? "",
      cert_expiry: profile.cert_expiry ?? "",
    });
    setEditing(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editForm || !profile) return;
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: editForm.full_name })
        .eq("id", profile.id);

      if (profileError) throw new Error("Failed to update profile.");

      // Update coaches table
      const { error: coachError } = await supabase
        .from("coaches")
        .update({
          bio: editForm.bio || null,
          specialization: editForm.specialization || null,
          years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : null,
          coach_type: editForm.coach_type,
          cert_number: editForm.cert_number || null,
          cert_body: editForm.cert_body || null,
          cert_expiry: editForm.cert_expiry || null,
        })
        .eq("id", profile.id);

      if (coachError) throw new Error("Failed to update coach details.");

      setEditing(false);
      await fetchProfile();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingCert(true);
    setUploadError(null);
    setUploadSuccess(false);

    const supabase = createClient();

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/certification.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("coach-certs")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw new Error("Failed to upload file.");

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("coach-certs")
        .getPublicUrl(filePath);

      // Update cert_file_url and set status to pending
      const { error: updateError } = await supabase
        .from("coaches")
        .update({
          cert_file_url: urlData.publicUrl,
          cert_status: "pending",
        })
        .eq("id", profile.id);

      if (updateError) throw new Error("Failed to update certification record.");

      setUploadSuccess(true);
      await fetchProfile();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadingCert(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen page-shell-narrow bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen page-shell-narrow bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error ?? "Profile not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell-narrow bg-gray-50">
      <CoachHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
        {!editing && (
          <button
            onClick={handleEditClick}
            className="rounded-full border border-teal-300 px-4 py-1.5 text-sm text-teal-600 hover:bg-teal-50 transition"
          >
            ✎ Edit Profile
          </button>
        )}
      </div>

      {/* Avatar & Name */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
          {profile.full_name?.[0] ?? "C"}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{profile.full_name ?? "—"}</h2>
          <p className="text-sm text-gray-500 capitalize">{profile.coach_type} Coach</p>
          {profile.club_name && (
            <p className="text-xs text-gray-400">{profile.club_name}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{profile.total_students}</p>
          <p className="text-xs text-gray-500">Assigned Students</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{profile.total_sessions}</p>
          <p className="text-xs text-gray-500">Completed Sessions</p>
        </div>
      </div>

      {/* VIEW MODE */}
      {!editing && (
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-800">Basic Info</h3>
            <div>
              <p className="text-xs text-gray-500">Specialization</p>
              <p className="text-sm text-gray-700">{profile.specialization ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Years of Experience</p>
              <p className="text-sm text-gray-700">{profile.years_experience ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Hire Date</p>
              <p className="text-sm text-gray-700">{formatDate(profile.hire_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Coach Type</p>
              <p className="text-sm text-gray-700 capitalize">{profile.coach_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bio</p>
              <p className="text-sm text-gray-700">{profile.bio ?? "—"}</p>
            </div>
          </div>

          {/* Certification */}
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Certification</h3>
              <CertStatusBadge status={profile.cert_status} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Certification Body</p>
              <p className="text-sm text-gray-700">{profile.cert_body ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Certificate Number</p>
              <p className="text-sm text-gray-700">{profile.cert_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expiry Date</p>
              <p className="text-sm text-gray-700">{formatDate(profile.cert_expiry)}</p>
            </div>

            {/* Cert file upload */}
            <div className="pt-2 border-t border-gray-100">
                <p className="mb-2 text-xs text-gray-500">Certification Document</p>
                {profile.cert_file_url && (
                    <a
                        href={profile.cert_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 inline-block text-xs text-teal-600 hover:underline"
                    >
                    View uploaded document ↗
                </a>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleCertUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCert}
                className="w-full rounded-lg border border-dashed border-teal-300 py-3 text-sm text-teal-600 hover:bg-teal-50 transition disabled:opacity-60"
              >
                {uploadingCert ? "Uploading..." : profile.cert_file_url ? "Replace Document" : "Upload Document"}
              </button>
              {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
              {uploadSuccess && <p className="mt-1 text-xs text-teal-600">Document uploaded successfully. Status set to pending review.</p>}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODE */}
      {editing && editForm && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Basic Info</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Full Name</label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Specialization</label>
              <input
                type="text"
                value={editForm.specialization}
                onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Years of Experience</label>
              <input
                type="number"
                min={0}
                value={editForm.years_experience}
                onChange={(e) => setEditForm({ ...editForm, years_experience: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Coach Type</label>
              <select
                value={editForm.coach_type}
                onChange={(e) => setEditForm({ ...editForm, coach_type: e.target.value as "club" | "independent" })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              >
                <option value="club">Club</option>
                <option value="independent">Independent</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Certification</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Certification Body</label>
              <input
                type="text"
                value={editForm.cert_body}
                onChange={(e) => setEditForm({ ...editForm, cert_body: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Certificate Number</label>
              <input
                type="text"
                value={editForm.cert_number}
                onChange={(e) => setEditForm({ ...editForm, cert_number: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Expiry Date</label>
              <input
                type="date"
                value={editForm.cert_expiry}
                onChange={(e) => setEditForm({ ...editForm, cert_expiry: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              />
            </div>
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/login");
        }}
        className="mt-8 w-full rounded-lg border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
      >
        Log Out
      </button>
      </div>
    </div>
  );
}