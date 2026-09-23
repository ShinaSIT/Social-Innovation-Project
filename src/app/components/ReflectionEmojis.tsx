import { REFLECTION_QUESTIONS, reflectionOption, type ReflectionAnswers } from "@/utils/swimmerReflection";

// A swimmer's three reflection answers as a compact emoji row, with each
// question + answer available on hover and to screen readers.
export default function ReflectionEmojis({ r }: { r: ReflectionAnswers }) {
  return (
    <span className="inline-flex gap-0.5">
      {REFLECTION_QUESTIONS.map((q) => {
        const o = reflectionOption(q.key, r[q.key]);
        return o ? (
          <span key={q.key} title={`${q.question} ${o.label}`} aria-label={`${q.question} ${o.label}`} role="img">
            {o.emoji}
          </span>
        ) : null;
      })}
    </span>
  );
}
