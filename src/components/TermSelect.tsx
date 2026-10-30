import { School } from '../api/types';

// Terms come from the school's settings, so nobody can type a term that
// doesn't exist (e.g. "2026 term 1" next to "2026 Term 1").
export default function TermSelect({
  school,
  value,
  onChange,
  className,
}: {
  school: School | null;
  value: string;
  onChange: (term: string) => void;
  className?: string;
}) {
  const terms = school?.terms ?? (value ? [value] : []);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} aria-label="Term">
      {terms.map((t) => (
        <option key={t} value={t}>
          {t}
          {t === school?.currentTerm ? ' (current)' : ''}
        </option>
      ))}
    </select>
  );
}
