import { FormEvent, useEffect, useState } from 'react';
import { school as schoolApi } from '../api/resources';
import { GradeBand } from '../api/types';
import { setSchoolCache, useSchool } from '../hooks/useSchool';

const DEFAULT_SCALE: GradeBand[] = [
  { minScore: 70, grade: 'A', remark: 'Excellent' },
  { minScore: 60, grade: 'B', remark: 'Very Good' },
  { minScore: 50, grade: 'C', remark: 'Good' },
  { minScore: 45, grade: 'D', remark: 'Fair' },
  { minScore: 40, grade: 'E', remark: 'Pass' },
  { minScore: 0, grade: 'F', remark: 'Fail' },
];

export default function SettingsPage() {
  const { school, error: loadError } = useSchool();
  const [newTerm, setNewTerm] = useState('');
  const [scale, setScale] = useState<GradeBand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (school) setScale(school.gradingScale.map((b) => ({ ...b })));
  }, [school]);

  async function save(data: Parameters<typeof schoolApi.update>[0], message: string) {
    setError(null);
    setSuccess(null);
    try {
      const updated = await schoolApi.update(data);
      setSchoolCache(updated);
      setSuccess(message);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    }
  }

  async function handleAddTerm(e: FormEvent) {
    e.preventDefault();
    if (!school) return;
    if (await save({ terms: [...school.terms, newTerm] }, `${newTerm.trim()} added.`)) setNewTerm('');
  }

  function removeTerm(term: string) {
    if (!school) return;
    if (!window.confirm(`Remove ${term} from the term list? Results already saved under it are kept, but it won't appear in term menus.`)) return;
    save({ terms: school.terms.filter((t) => t !== term) }, `${term} removed.`);
  }

  function updateBand(i: number, patch: Partial<GradeBand>) {
    setScale(scale.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!school) return <p>Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>
      <p className="page-subtitle">Terms and grading used across attendance, grades, result cards and fees.</p>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card mb-6">
        <h2>Terms</h2>
        <p className="info-card-sub mb-3">
          The current term is what every screen opens on. Grades and results can only be entered for a term listed here.
        </p>
        <form className="inline-form" onSubmit={handleAddTerm}>
          <input
            placeholder="New term, e.g. 2025/2026 First Term"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            className="flex-1 min-w-[240px]"
            required
          />
          <button type="submit">Add term</button>
        </form>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Term</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {school.terms.map((t) => (
                <tr key={t}>
                  <td>{t}</td>
                  <td>{t === school.currentTerm && <span className="status-badge status-Active">Current</span>}</td>
                  <td>
                    {t !== school.currentTerm && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => save({ currentTerm: t }, `${t} is now the current term.`)}>
                          Make current
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => removeTerm(t)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Grading scale</h2>
        <p className="info-card-sub mb-3">
          Total score (CA 40 + Exam 60 = 100) at or above the minimum gets that grade. Applies to every result, including
          ones already entered.
        </p>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>From score</th>
                <th>Grade</th>
                <th>Remark</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scale.map((b, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={b.minScore}
                      onChange={(e) => updateBand(i, { minScore: Number(e.target.value) })}
                      className="w-24"
                    />
                  </td>
                  <td>
                    <input value={b.grade} onChange={(e) => updateBand(i, { grade: e.target.value })} className="w-20" />
                  </td>
                  <td>
                    <input value={b.remark} onChange={(e) => updateBand(i, { remark: e.target.value })} />
                  </td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => setScale(scale.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={() => setScale([...scale, { minScore: 0, grade: '', remark: '' }])}>
            Add band
          </button>
          <button type="button" className="btn-secondary" onClick={() => setScale(DEFAULT_SCALE.map((b) => ({ ...b })))}>
            Reset to standard Nigerian scale
          </button>
          <button type="button" onClick={() => save({ gradingScale: scale }, 'Grading scale saved.')}>
            Save grading scale
          </button>
        </div>
      </div>
    </div>
  );
}
