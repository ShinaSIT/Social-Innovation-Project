"use client";

import CoachHeader from "@/app/coach/components/CoachHeader";

type ModuleStatus = "completed" | "start" | "locked";

interface Module {
  title: string;
  description: string;
  duration: string;
  status: ModuleStatus;
}

interface Category {
  name: string;
  progress: string;
  modules: Module[];
}

const overallProgress = 38;
const completedModules = 3;
const totalModules = 8;

const categories: Category[] = [
  {
    name: "Foundation",
    progress: "2/2 complete",
    modules: [
      { title: "Introduction to Autism-Inclusive Coaching", description: "Understanding neurodiversity in aquatic environments", duration: "15 min", status: "completed" },
      { title: "Sensory Considerations in Water", description: "Managing sensory sensitivities during swim lessons", duration: "20 min", status: "completed" },
    ],
  },
  {
    name: "Communication",
    progress: "1/2 complete",
    modules: [
      { title: "Visual Communication Strategies", description: "Using visual cues and schedules effectively", duration: "12 min", status: "completed" },
      { title: "Parent Partnership Strategies", description: "Building collaborative relationships with families", duration: "15 min", status: "start" },
    ],
  },
  {
    name: "Behavior",
    progress: "0/1 complete",
    modules: [
      { title: "Positive Behavior Support", description: "Evidence-based approaches to challenging behaviors", duration: "18 min", status: "start" },
    ],
  },
  {
    name: "Practical Skills",
    progress: "0/1 complete",
    modules: [
      { title: "Transition Management", description: "Supporting smooth transitions between activities", duration: "14 min", status: "start" },
    ],
  },
  {
    name: "Planning",
    progress: "0/1 complete",
    modules: [
      { title: "Individual Education Plan (IEP) Integration", description: "Aligning swim goals with educational objectives", duration: "14 min", status: "locked" },
    ],
  },
  {
    name: "Safety",
    progress: "0/1 complete",
    modules: [
      { title: "Crisis Prevention & De-escalation", description: "Safety protocols and calming techniques", duration: "20 min", status: "locked" },
    ],
  },
];

function StatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "completed") {
    return <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">Completed</span>;
  }
  if (status === "start") {
    return <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-medium text-white">Start</span>;
  }
  return <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-500">Locked</span>;
}

function ActionButton({ status }: { status: ModuleStatus }) {
  if (status === "completed") {
    return (
      <button className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
        Review
      </button>
    );
  }
  return null;
}

export default function CoachTrainingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-xl font-bold text-gray-800">Coach Training</h1>
      </div>
      <p className="mb-6 text-sm text-gray-500">Autism-inclusive swim coaching certification</p>

      {/* Overall Progress */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Overall Progress</h2>
            <p className="text-xs text-gray-500">Unit {completedModules} modules completed</p>
          </div>
          <span className="text-2xl font-bold text-teal-600">{overallProgress}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-100">
          <div className="h-2.5 rounded-full bg-teal-400" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{cat.name}</h2>
              <span className="text-xs text-gray-500">{cat.progress}</span>
            </div>
            <div className="space-y-2">
              {cat.modules.map((mod) => (
                <div
                  key={mod.title}
                  className={`rounded-xl bg-white p-4 shadow-sm ${mod.status === "locked" ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        mod.status === "completed" ? "bg-teal-100" : "bg-gray-100"
                      }`}>
                        {mod.status === "completed" ? (
                          <span className="text-teal-600 text-sm">&#10003;</span>
                        ) : (
                          <span className="text-gray-400 text-sm">&#9679;</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-800">{mod.title}</h3>
                        <p className="text-xs text-gray-500">{mod.description}</p>
                        <p className="mt-1 text-xs text-gray-400">&#128337; {mod.duration}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={mod.status} />
                      <ActionButton status={mod.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Certification CTA */}
      <div className="mt-6 rounded-xl bg-teal-500 p-4 text-white">
        <h3 className="font-semibold">Certification Progress</h3>
        <p className="text-sm opacity-80">Complete all 8 modules to earn your Autism-Inclusive Swim Coach certification.</p>
        <p className="mt-1 text-xs opacity-60">{completedModules} modules remaining</p>
      </div>
      </div>
    </div>
  );
}
