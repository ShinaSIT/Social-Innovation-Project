// Shared types/constants for swimmer classification and the parent's
// requested timing / class-type fields — used by the class detail page and
// the all-students list so both stay in sync.

export type Classification = "not_yet_assessed" | "normal" | "mild" | "severe";
export type ClassTypePreference = "no_preference" | "group" | "1-1";

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  not_yet_assessed: "Not yet assessed",
  normal: "Normal",
  mild: "Mild",
  severe: "Severe",
};

export const CLASSIFICATION_STYLES: Record<Classification, string> = {
  not_yet_assessed: "bg-gray-100 text-gray-500",
  normal: "bg-blue-50 text-blue-700",
  mild: "bg-amber-50 text-amber-700",
  severe: "bg-red-50 text-red-700",
};

export const CLASS_TYPE_LABELS: Record<ClassTypePreference, string> = {
  no_preference: "No preference",
  group: "Group",
  "1-1": "1-1",
};

export interface SwimmerRequestData {
  requested_days: string[];
  requested_time_start: string | null;
  requested_time_end: string | null;
  class_type_preference: ClassTypePreference;
  class_type_notes: string | null;
}

export const EMPTY_SWIMMER_REQUEST: SwimmerRequestData = {
  requested_days: [],
  requested_time_start: null,
  requested_time_end: null,
  class_type_preference: "no_preference",
  class_type_notes: null,
};
