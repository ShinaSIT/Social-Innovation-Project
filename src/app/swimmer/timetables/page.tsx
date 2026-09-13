"use client";

import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";
import TimetableList from "@/app/components/TimetableList";

export default function SwimmerTimetablesPage() {
  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <SwimmerHeader />
      <div id="main-content" tabIndex={-1} className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Timetables</h1>
          <p className="text-sm text-gray-500">Schedules uploaded by your club.</p>
        </div>
        <TimetableList />
      </div>
    </div>
  );
}
