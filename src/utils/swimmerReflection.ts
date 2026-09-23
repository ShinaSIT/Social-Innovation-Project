// Swimmer's own post-class reflection: three emoji scales, no typing.
// Answers are stored as 1-5 in swimmer_session_reflections.

export interface ReflectionAnswers {
  feeling: number;
  difficulty: number;
  self_rating: number;
}

export type ReflectionKey = keyof ReflectionAnswers;

export interface ReflectionQuestion {
  key: ReflectionKey;
  question: string;
  options: { value: number; emoji: string; label: string }[];
}

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    key: "feeling",
    question: "How did you feel during the session?",
    options: [
      { value: 1, emoji: "😢", label: "Very sad" },
      { value: 2, emoji: "🙁", label: "Sad" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "🙂", label: "Happy" },
      { value: 5, emoji: "😄", label: "Very happy" },
    ],
  },
  {
    key: "difficulty",
    question: "Was today's session easy or hard?",
    options: [
      { value: 1, emoji: "😌", label: "Very easy" },
      { value: 2, emoji: "🙂", label: "Easy" },
      { value: 3, emoji: "😐", label: "Just right" },
      { value: 4, emoji: "😣", label: "Hard" },
      { value: 5, emoji: "😫", label: "Very hard" },
    ],
  },
  {
    key: "self_rating",
    question: "How well do you think you did?",
    options: [
      { value: 1, emoji: "😞", label: "Not great" },
      { value: 2, emoji: "😕", label: "Could be better" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "🤩", label: "Amazing" },
    ],
  },
];

export function reflectionOption(key: ReflectionKey, value: number) {
  return REFLECTION_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value) ?? null;
}
