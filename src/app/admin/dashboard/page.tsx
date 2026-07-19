"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import Pagination from "@/app/components/Pagination";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import LogoutButton from "@/components/LogoutButton";

const AT_RISK_PAGE_SIZE = 5;

interface Stats {
  totalSwimmers: number;
  activeCoaches: number;
  atRisk: number;
  avgProgress: number;
}

interface CoachStat {
  id: string;
  name: string;
  studentCount: number;
  avgProgress: number;
}

interface AtRiskStudent {
  id: string;
  name: string;
  issue: string;
}

interface LevelDistribution {
  level: string;
  count: number;
}

interface MonthlyEnrollment {
  month: string;
  count: number;
}

interface Swimmer {
  id: string;
  name: string;
}

interface Coach {
  id: string;
  name: string;
  isAssigned: boolean;
}

interface CoachRequest {
  id: string;
  swimmer_id: string;
  swimmer_name: string;
  message: string | null;
  qualifications: string | null;
  experience: string | null;
  certifications: string | null;
  created_at: string;
}

function getLastSixMonths(): { label: string; year: number; month: number }[] {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return months;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalSwimmers: 0,
    activeCoaches: 0,
    atRisk: 0,
    avgProgress: 0,
  });
  const [coachStats, setCoachStats] = useState<CoachStat[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [levelDistribution, setLevelDistribution] = useState<LevelDistribution[]>([]);
  const [monthlyEnrollment, setMonthlyEnrollment] = useState<MonthlyEnrollment[]>([]);
  const [clubName, setClubName] = useState<string>("Club Overview");
  const [clubId, setClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
  const [allCoaches, setAllCoaches] = useState<Coach[]>([]);
  const [selectedSwimmer, setSelectedSwimmer] = useState<Swimmer | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [loadingAssignData, setLoadingAssignData] = useState(false);
  const [atRiskPage, setAtRiskPage] = useState(1);

  const [coachRequests, setCoachRequests] = useState<CoachRequest[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CoachRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeAssignModal = useCallback(() => setShowAssignModal(false), []);
  useFocusTrap(modalRef, showAssignModal, closeAssignModal);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      // 1. Get admin's club_id
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      if (adminError) throw new Error("Failed to load admin profile.");

      const cId = adminProfile?.club_id;
      setClubId(cId);

      // 2. Fetch club name
      if (cId) {
        const { data: clubData } = await supabase
          .from("clubs")
          .select("name")
          .eq("id", cId)
          .single();
        setClubName(clubData?.name ?? "Club Overview");
      }

      // 3. Fetch all swimmers in club
      const { data: swimmers, error: swimmersError } = await supabase
        .from("swimmers")
        .select("id, level, progress, club_id")
        .eq("club_id", cId);

      if (swimmersError) throw new Error("Failed to load swimmers.");

      const swimmerIds = (swimmers ?? []).map((s) => s.id);
      const totalSwimmers = swimmers?.length ?? 0;
      const avgProgress = totalSwimmers > 0
        ? Math.round((swimmers ?? []).reduce((sum, s) => sum + (s.progress ?? 0), 0) / totalSwimmers)
        : 0;

      // 4. Level distribution
      const levelMap: Record<string, number> = {};
      for (const s of swimmers ?? []) {
        const key = s.level ? `Level ${s.level}` : "Unknown";
        levelMap[key] = (levelMap[key] ?? 0) + 1;
      }
      const levels: LevelDistribution[] = Object.entries(levelMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([level, count]) => ({ level, count }));
      setLevelDistribution(levels);

      // 5. At risk swimmers (progress < 30)
      const atRiskByProgress = (swimmers ?? []).filter((s) => (s.progress ?? 0) < 30);

      // 6. Fetch cancelled sessions for at risk
      const { data: cancelledSessions } = await supabase
        .from("sessions")
        .select("swimmer_id")
        .in("swimmer_id", swimmerIds)
        .eq("status", "cancelled");

      const cancelledMap: Record<string, number> = {};
      for (const s of cancelledSessions ?? []) {
        cancelledMap[s.swimmer_id] = (cancelledMap[s.swimmer_id] ?? 0) + 1;
      }

      // 7. Fetch low engagement scores (overall_feel avg < 3)
      const { data: feedbackData } = await supabase
        .from("session_feedback")
        .select("swimmer_id, overall_feel")
        .in("swimmer_id", swimmerIds);

      const feedbackMap: Record<string, number[]> = {};
      for (const f of feedbackData ?? []) {
        if (!feedbackMap[f.swimmer_id]) feedbackMap[f.swimmer_id] = [];
        if (f.overall_feel) feedbackMap[f.swimmer_id].push(f.overall_feel);
      }

      const lowEngagementIds = new Set(
        Object.entries(feedbackMap)
          .filter(([, scores]) => {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return avg < 3;
          })
          .map(([id]) => id)
      );

      // 8. Fetch swimmer names for at risk
      const atRiskIds = new Set([
        ...atRiskByProgress.map((s) => s.id),
        ...Object.keys(cancelledMap).filter((id) => cancelledMap[id] >= 2),
        ...Array.from(lowEngagementIds),
      ]);

      const { data: atRiskProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(atRiskIds));

      const atRiskList: AtRiskStudent[] = (atRiskProfiles ?? []).map((p) => {
        const issues = [];
        if ((swimmers ?? []).find((s) => s.id === p.id && (s.progress ?? 0) < 30)) {
          issues.push("Low progress");
        }
        if (cancelledMap[p.id] >= 2) {
          issues.push(`${cancelledMap[p.id]} cancelled sessions`);
        }
        if (lowEngagementIds.has(p.id)) {
          issues.push("Low engagement scores");
        }
        return {
          id: p.id,
          name: p.full_name ?? "Unknown",
          issue: issues.join(" • "),
        };
      });

      setAtRiskStudents(atRiskList);

      // 9. Active coaches in club
      const { data: coaches, error: coachesError } = await supabase
        .from("coaches")
        .select("id")
        .eq("club_id", cId)
        .eq("is_active", true);

      if (coachesError) throw new Error("Failed to load coaches.");

      const coachIds = (coaches ?? []).map((c) => c.id);

      // 10. Coach stats
      const { data: coachAssignments } = await supabase
        .from("coach_students")
        .select("coach_id, swimmer_id")
        .in("coach_id", coachIds);

      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds);

      const coachStatList: CoachStat[] = (coachProfiles ?? []).map((profile) => {
        const assignedSwimmerIds = (coachAssignments ?? [])
          .filter((a) => a.coach_id === profile.id)
          .map((a) => a.swimmer_id);

        const assignedSwimmers = (swimmers ?? []).filter((s) =>
          assignedSwimmerIds.includes(s.id)
        );

        const avgP = assignedSwimmers.length > 0
          ? Math.round(
              assignedSwimmers.reduce((sum, s) => sum + (s.progress ?? 0), 0) /
              assignedSwimmers.length
            )
          : 0;

        return {
          id: profile.id,
          name: profile.full_name ?? "Unknown",
          studentCount: assignedSwimmers.length,
          avgProgress: avgP,
        };
      }).sort((a, b) => b.avgProgress - a.avgProgress);

      setCoachStats(coachStatList);

      // 11. Monthly enrollment trend
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const { data: enrollmentData } = await supabase
        .from("profiles")
        .select("created_at")
        .in("id", swimmerIds)
        .gte("created_at", sixMonthsAgo.toISOString());

      const months = getLastSixMonths();
      const enrollment: MonthlyEnrollment[] = months.map(({ label, year, month }) => {
        const count = (enrollmentData ?? []).filter((p) => {
          const d = new Date(p.created_at);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        }).length;
        return { month: label, count };
      });
      setMonthlyEnrollment(enrollment);

      // 12. Set final stats
      setStats({
        totalSwimmers,
        activeCoaches: coaches?.length ?? 0,
        atRisk: atRiskIds.size,
        avgProgress,
      });

      // 13. Fetch pending coach requests
      const { data: requestsData } = await supabase
        .from("coach_requests")
        .select("id, swimmer_id, message, qualifications, experience, certifications, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      const requesterIds = (requestsData ?? []).map((r) => r.swimmer_id);

      if (requesterIds.length > 0) {
        const { data: requesterProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", requesterIds);

        const nameMap: Record<string, string> = {};
        for (const p of requesterProfiles ?? []) nameMap[p.id] = p.full_name ?? "Unknown";

        setCoachRequests(
          (requestsData ?? []).map((r) => ({
            ...r,
            swimmer_name: nameMap[r.swimmer_id] ?? "Unknown",
          }))
        );
      } else {
        setCoachRequests([]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToCoach = async (request: CoachRequest) => {
    setPromotingId(request.id);
    const supabase = createClient();

    try {
      const { error: roleError } = await supabase.rpc("promote_to_coach", {
        target_user_id: request.swimmer_id,
      });

      if (roleError) throw new Error("Failed to promote user: " + roleError.message);

      const { error: coachError } = await supabase
        .from("coaches")
        .upsert({ id: request.swimmer_id, club_id: clubId ?? null });

      if (coachError) throw new Error("Failed to create coach record.");

      const { data: { user } } = await supabase.auth.getUser();
      const { error: requestError } = await supabase
        .from("coach_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (requestError) throw new Error("Failed to update request status.");

      setShowRequestModal(false);
      setSelectedRequest(null);
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPromotingId(null);
    }
  };

  const fetchAssignData = async () => {
    const supabase = createClient();
    setLoadingAssignData(true);
    setAssignError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user!.id)
        .single();

      const cId = adminProfile?.club_id;

      const { data: swimmerIds } = await supabase
        .from("swimmers")
        .select("id")
        .eq("club_id", cId);

      const ids = (swimmerIds ?? []).map((s) => s.id);

      const { data: swimmerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);

      setAllSwimmers(
        (swimmerProfiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name ?? "Unknown",
        }))
      );

      const { data: coaches } = await supabase
        .from("coaches")
        .select("id")
        .eq("club_id", cId)
        .eq("is_active", true);

      const coachIds = (coaches ?? []).map((c) => c.id);

      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds);

      setAllCoaches(
        (coachProfiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name ?? "Unknown",
          isAssigned: false,
        }))
      );
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setLoadingAssignData(false);
    }
  };

  const fetchAssignedCoaches = async (swimmerId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("coach_students")
      .select("coach_id")
      .eq("swimmer_id", swimmerId);

    const assigned = (data ?? []).map((r) => r.coach_id);
    setAssignedCoaches(assigned);
    setAllCoaches((prev) =>
      prev.map((c) => ({ ...c, isAssigned: assigned.includes(c.id) }))
    );
  };

  const handleSelectSwimmer = async (swimmer: Swimmer) => {
    setSelectedSwimmer(swimmer);
    setAssignSuccess(null);
    setAssignError(null);
    await fetchAssignedCoaches(swimmer.id);
  };

  const handleAssign = async (coachId: string) => {
    if (!selectedSwimmer) return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("coach_students")
      .insert({ coach_id: coachId, swimmer_id: selectedSwimmer.id });

    if (error) {
      setAssignError("Failed to assign coach.");
    } else {
      setAssignSuccess("Coach assigned successfully.");
      await fetchAssignedCoaches(selectedSwimmer.id);
    }
    setAssignLoading(false);
  };

  const handleUnassign = async (coachId: string) => {
    if (!selectedSwimmer) return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("coach_students")
      .delete()
      .eq("coach_id", coachId)
      .eq("swimmer_id", selectedSwimmer.id);

    if (error) {
      setAssignError("Failed to unassign coach.");
    } else {
      setAssignSuccess("Coach unassigned successfully.");
      await fetchAssignedCoaches(selectedSwimmer.id);
    }
    setAssignLoading(false);
  };

  const openAssignModal = async () => {
    setShowAssignModal(true);
    setSelectedSwimmer(null);
    setAssignedCoaches([]);
    setAssignSuccess(null);
    setAssignError(null);
    await fetchAssignData();
  };

  const maxEnrollment = Math.max(...monthlyEnrollment.map((m) => m.count), 1);
  const levelColors = ["bg-teal-200", "bg-teal-400", "bg-teal-600", "bg-teal-800", "bg-teal-900"];
  const pieColors = ["#99f6e4", "#2dd4bf", "#0d9488", "#134e4a", "#042f2e"];

  const statCards = [
    { label: "Total Swimmers", value: stats.totalSwimmers, icon: "&#128101;" },
    { label: "Active Coaches", value: stats.activeCoaches, icon: "&#128105;&#8205;&#127891;" },
    { label: "At Risk", value: stats.atRisk, icon: "&#9888;&#65039;" },
    { label: "Avg Progress", value: `${stats.avgProgress}%`, icon: "&#128200;" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">{clubName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openAssignModal}
              className="flex items-center gap-1 rounded-lg border border-teal-500 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 transition"
            >
              <span aria-hidden="true">&#128101;</span> Assign Swimmers
            </button>
            <Link
              href="/admin/reports"
              className="flex items-center gap-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
            >
              <span aria-hidden="true">&#128202;</span> Generate Reports
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm text-center">
              <p className="text-2xl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: s.icon }} />
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {/* Swimmer Level Distribution */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Swimmer Level Distribution</h2>
            {levelDistribution.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No data available.</p>
            ) : (
              <div className="flex items-center justify-center gap-6">
                <div className="relative h-32 w-32">
                  <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                    {(() => {
                      const total = levelDistribution.reduce((a, b) => a + b.count, 0);
                      let offset = 0;
                      return levelDistribution.map((level, i) => {
                        const pct = (level.count / total) * 100;
                        const el = (
                          <circle
                            key={level.level}
                            cx="18" cy="18" r="15.9155"
                            fill="transparent"
                            stroke={pieColors[i % pieColors.length]}
                            strokeWidth="3.5"
                            strokeDasharray={`${pct} ${100 - pct}`}
                            strokeDashoffset={`${-offset}`}
                          />
                        );
                        offset += pct;
                        return el;
                      });
                    })()}
                  </svg>
                </div>
                <div className="space-y-2">
                  {levelDistribution.map((l, i) => (
                    <div key={l.level} className="flex items-center gap-2 text-sm">
                      <div className={`h-3 w-3 rounded-full ${levelColors[i % levelColors.length]}`} />
                      <span className="text-gray-600">{l.level} ({l.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Enrollment Trend */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-800">Monthly Enrollment Trend</h2>
            <div className="flex items-end gap-3 h-40">
              {monthlyEnrollment.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center">
                  <p className="mb-1 text-xs text-gray-600">{m.count}</p>
                  <div
                    className="w-full rounded-t bg-teal-400"
                    style={{ height: `${(m.count / maxEnrollment) * 100}px` }}
                  />
                  <p className="mt-1 text-xs text-gray-500">{m.month}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coach Student Progress */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Coach Student Progress</h2>
          {coachStats.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No coach data available.</p>
          ) : (
            <div className="space-y-3">
              {coachStats.map((coach) => (
                <div key={coach.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-medium text-teal-700">
                    {coach.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{coach.name}</span>
                      <span className="text-xs text-gray-500">
                        {coach.studentCount} students • {coach.avgProgress}% avg
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-teal-400"
                        style={{ width: `${coach.avgProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students Requiring Attention */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">
            <span aria-hidden="true">⚠️</span> Students Requiring Attention
          </h2>
          {atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No students require attention.</p>
          ) : (
            <>
              <div className="space-y-3">
                {atRiskStudents
                  .slice((atRiskPage - 1) * AT_RISK_PAGE_SIZE, atRiskPage * AT_RISK_PAGE_SIZE)
                  .map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.issue}</p>
                      </div>
                      <Link
                        href={`/coach/students/${s.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
              </div>
              <Pagination
                currentPage={atRiskPage}
                totalItems={atRiskStudents.length}
                pageSize={AT_RISK_PAGE_SIZE}
                onPageChange={setAtRiskPage}
                itemLabel="students"
              />
            </>
          )}
        </div>

        {/* Coach Applications Section */}
        {coachRequests.length > 0 && (
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">&#127941; Coach Applications</h2>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                {coachRequests.length} pending
              </span>
            </div>
            <div className="space-y-3">
              {coachRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                      {request.swimmer_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{request.swimmer_name}</p>
                      <p className="text-xs text-gray-500">
                        Applied {new Date(request.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedRequest(request); setShowRequestModal(true); }}
                    className="rounded-full border border-teal-300 px-3 py-1 text-xs text-teal-600 hover:bg-teal-50 transition"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeAssignModal(); }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="assign-modal-title"
              tabIndex={-1}
              className="w-full max-w-md rounded-xl bg-white shadow-xl focus:outline-none"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 id="assign-modal-title" className="font-semibold text-gray-800">Assign Swimmer to Coach</h2>
                <button onClick={closeAssignModal} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {loadingAssignData ? (
                  <p className="text-center text-sm text-gray-500 py-4">Loading...</p>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Select Swimmer</label>
                      <select
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                        value={selectedSwimmer?.id ?? ""}
                        onChange={(e) => {
                          const swimmer = allSwimmers.find((s) => s.id === e.target.value);
                          if (swimmer) handleSelectSwimmer(swimmer);
                        }}
                      >
                        <option value="">-- Select a swimmer --</option>
                        {allSwimmers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedSwimmer && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-gray-700">
                          Coaches for {selectedSwimmer.name}
                        </p>
                        {allCoaches.length === 0 ? (
                          <p className="text-sm text-gray-500">No coaches available.</p>
                        ) : (
                          <div className="space-y-2">
                            {allCoaches.map((coach) => (
                              <div key={coach.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-medium text-teal-700">
                                    {coach.name.split(" ").map((n) => n[0]).join("")}
                                  </div>
                                  <span className="text-sm text-gray-700">{coach.name}</span>
                                </div>
                                {coach.isAssigned ? (
                                  <button
                                    onClick={() => handleUnassign(coach.id)}
                                    disabled={assignLoading}
                                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-60"
                                  >
                                    Unassign
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAssign(coach.id)}
                                    disabled={assignLoading}
                                    className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-600 hover:bg-teal-100 transition disabled:opacity-60"
                                  >
                                    Assign
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {assignError && <p className="text-sm text-red-500">{assignError}</p>}
                    {assignSuccess && <p className="text-sm text-teal-600">{assignSuccess}</p>}
                  </>
                )}
              </div>

              <div className="border-t border-gray-100 p-4">
                <button
                  onClick={() => { setShowAssignModal(false); fetchDashboard(); }}
                  className="w-full rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request Review Modal */}
        {showRequestModal && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-800">
                  Coach Application — {selectedRequest.swimmer_name}
                </h2>
                <button
                  onClick={() => { setShowRequestModal(false); setSelectedRequest(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Qualifications</p>
                  <p className="text-sm text-gray-700">{selectedRequest.qualifications ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Experience</p>
                  <p className="text-sm text-gray-700">{selectedRequest.experience ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Certifications</p>
                  <p className="text-sm text-gray-700">{selectedRequest.certifications ?? "—"}</p>
                </div>
                {selectedRequest.message && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">Additional Message</p>
                    <p className="text-sm text-gray-700">{selectedRequest.message}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 p-4 flex gap-3">
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase
                      .from("coach_requests")
                      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
                      .eq("id", selectedRequest.id);
                    setShowRequestModal(false);
                    setSelectedRequest(null);
                    await fetchDashboard();
                  }}
                  className="flex-1 rounded-full border border-red-200 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => handlePromoteToCoach(selectedRequest)}
                  disabled={promotingId === selectedRequest.id}
                  className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {promotingId === selectedRequest.id ? "Promoting..." : "Approve & Promote"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}