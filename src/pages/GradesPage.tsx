import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  classes as classesApi,
  grades as gradesApi,
  reportCards as reportCardsApi,
  students as studentsApi,
  subjects as subjectsApi,
} from '../api/resources';
import { ConductRating, Grade, GradeBand, ReportCard, SchoolClass, Student, Subject } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import TermSelect from '../components/TermSelect';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';

const CONDUCT_OPTIONS: ConductRating[] = ['Excellent', 'Good', 'Fair', 'Needs Improvement'];

function gradeFor(total: number, scale: GradeBand[]): string {
  const band = [...scale].sort((a, b) => b.minScore - a.minScore).find((b) => total >= b.minScore);
  return band?.grade ?? '';
}

function byName(a: Student, b: Student) {
  return a.name.localeCompare(b.name);
}

// Ask before throwing away typed-in work.
function confirmDiscard(unsaved: number): boolean {
  return unsaved === 0 || window.confirm(`You have ${unsaved} unsaved change${unsaved === 1 ? '' : 's'}. Leave without saving?`);
}

function useWarnOnLeave(unsaved: number) {
  useEffect(() => {
    if (unsaved === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsaved]);
}

/* ---------------------------------------------------------------- */
/* Scores: one row per student for the chosen subject                */
/* ---------------------------------------------------------------- */

type ScoreDraft = Record<string, { ca: string; exam: string }>;

function parseScore(value: string, max: number): number | null | 'invalid' {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : 'invalid';
}

function ScoreSheet({
  classId,
  subject,
  term,
  roster,
  scale,
  onUnsavedChange,
}: {
  classId: string;
  subject: { id: string; name: string };
  term: string;
  roster: Student[];
  scale: GradeBand[];
  onUnsavedChange: (n: number) => void;
}) {
  const [saved, setSaved] = useState<Grade[]>([]);
  const [draft, setDraft] = useState<ScoreDraft>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const savedByStudent = useMemo(() => new Map(saved.map((g) => [g.studentId, g])), [saved]);

  function resetDraft(grades: Grade[]) {
    const next: ScoreDraft = {};
    for (const g of grades) next[g.studentId] = { ca: String(g.caScore), exam: String(g.examScore) };
    setDraft(next);
  }

  function load() {
    setLoading(true);
    gradesApi
      .list({ classId, term })
      .then((all) => {
        const forSubject = all.filter((g) => g.subjectId === subject.id);
        setSaved(forSubject);
        resetDraft(forSubject);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setError(null);
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subject.id, term]);

  // Work out each row's state from what's typed vs. what's saved.
  const rows = roster.map((student) => {
    const d = draft[student._id] ?? { ca: '', exam: '' };
    const savedGrade = savedByStudent.get(student._id);
    const ca = parseScore(d.ca, 40);
    const exam = parseScore(d.exam, 60);
    const changed = savedGrade
      ? d.ca !== String(savedGrade.caScore) || d.exam !== String(savedGrade.examScore)
      : d.ca.trim() !== '' || d.exam.trim() !== '';
    let problem: string | null = null;
    if (ca === 'invalid') problem = 'CA must be 0–40';
    else if (exam === 'invalid') problem = 'Exam must be 0–60';
    else if (changed && (ca === null || exam === null)) {
      problem = savedGrade && ca === null && exam === null ? 'Use Delete to remove a score' : 'Enter both CA and Exam';
    }
    const total = typeof ca === 'number' && typeof exam === 'number' ? ca + exam : null;
    return { student, d, savedGrade, ca, exam, changed, problem, total };
  });

  const changedRows = rows.filter((r) => r.changed);
  const hasProblems = changedRows.some((r) => r.problem);
  const scoredCount = rows.filter((r) => r.savedGrade).length;

  useEffect(() => onUnsavedChange(changedRows.length), [changedRows.length, onUnsavedChange]);

  function setCell(studentId: string, field: 'ca' | 'exam', value: string) {
    setMessage(null);
    setDraft((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? { ca: '', exam: '' }), [field]: value } }));
  }

  async function saveAll() {
    if (changedRows.length === 0 || hasProblems) return;
    setBusy(true);
    setError(null);
    try {
      await gradesApi.saveSheet({
        classId,
        subjectId: subject.id,
        term,
        entries: changedRows.map((r) => ({ studentId: r.student._id, caScore: r.ca as number, examScore: r.exam as number })),
      });
      setMessage(`Saved ${changedRows.length} score${changedRows.length === 1 ? '' : 's'} for ${subject.name}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scores');
    } finally {
      setBusy(false);
    }
  }

  async function deleteScore(student: Student, grade: Grade) {
    if (!window.confirm(`Delete ${student.name}'s ${subject.name} score (${grade.total})? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await gradesApi.remove(grade._id);
      setMessage(`Deleted ${student.name}'s ${subject.name} score.`);
      setSaved((prev) => prev.filter((g) => g._id !== grade._id));
      setDraft((prev) => {
        const next = { ...prev };
        delete next[student._id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete score');
    } finally {
      setBusy(false);
    }
  }

  function clearRow(studentId: string) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  }

  if (roster.length === 0) return <p className="info-card-empty">This class has no students yet.</p>;

  return (
    <div>
      <p className="info-card-sub mb-3">
        <strong className="text-ink">{subject.name}</strong> · {scoredCount} of {roster.length} students have a score. Type the
        scores, then click <strong className="text-ink">Save all</strong>.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      <div className="table-scroll">
        <table className="data-table score-sheet">
          <thead>
            <tr>
              <th>Student</th>
              <th>CA (0–40)</th>
              <th>Exam (0–60)</th>
              <th>Total</th>
              <th>Grade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.student._id} className={r.problem ? 'row-problem' : r.changed ? 'row-changed' : undefined}>
                  <td>
                    {r.student.name}
                    {r.problem ? (
                      <div className="text-xs text-red-600">{r.problem}</div>
                    ) : r.changed ? (
                      <div className="text-xs text-amber-700">Not saved yet</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={40}
                      value={r.d.ca}
                      onChange={(e) => setCell(r.student._id, 'ca', e.target.value)}
                      className={r.ca === 'invalid' ? 'input-invalid w-20' : 'w-20'}
                      aria-label={`CA score for ${r.student.name}`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={60}
                      value={r.d.exam}
                      onChange={(e) => setCell(r.student._id, 'exam', e.target.value)}
                      className={r.exam === 'invalid' ? 'input-invalid w-20' : 'w-20'}
                      aria-label={`Exam score for ${r.student.name}`}
                    />
                  </td>
                  <td className="font-semibold">{r.total ?? '—'}</td>
                  <td>
                    {r.total !== null ? (
                      <span className={`status-badge grade-${gradeFor(r.total, scale)}`}>{gradeFor(r.total, scale)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">
                    {r.savedGrade ? (
                      <button
                        type="button"
                        className="btn-danger-soft"
                        onClick={() => deleteScore(r.student, r.savedGrade!)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    ) : r.changed ? (
                      <button type="button" className="btn-secondary" onClick={() => clearRow(r.student._id)}>
                        Clear
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="save-bar">
        <span className="text-sm text-ink-soft">
          {changedRows.length === 0
            ? 'All changes saved.'
            : hasProblems
              ? 'Fix the rows marked in red to save.'
              : `${changedRows.length} unsaved change${changedRows.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex gap-2">
          {changedRows.length > 0 && (
            <button type="button" className="btn-secondary" onClick={() => resetDraft(saved)} disabled={busy}>
              Undo changes
            </button>
          )}
          <button type="button" onClick={saveAll} disabled={busy || changedRows.length === 0 || hasProblems}>
            {busy ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Conduct & comments: one row per student (form teacher / admin)    */
/* ---------------------------------------------------------------- */

type ConductDraft = Record<string, { rating: ConductRating | ''; comment: string }>;

function ConductSheet({
  classId,
  term,
  roster,
  onUnsavedChange,
}: {
  classId: string;
  term: string;
  roster: Student[];
  onUnsavedChange: (n: number) => void;
}) {
  const [saved, setSaved] = useState<ConductDraft>({});
  const [draft, setDraft] = useState<ConductDraft>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    reportCardsApi
      .listForClass(classId, term)
      .then((cards: ReportCard[]) => {
        const next: ConductDraft = {};
        for (const c of cards) next[c.studentId] = { rating: c.conductRating ?? '', comment: c.teacherComment ?? '' };
        setSaved(next);
        setDraft(next);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setError(null);
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term]);

  const empty = { rating: '' as const, comment: '' };
  const changed = roster.filter((s) => {
    const a = draft[s._id] ?? empty;
    const b = saved[s._id] ?? empty;
    return a.rating !== b.rating || a.comment.trim() !== b.comment.trim();
  });

  useEffect(() => onUnsavedChange(changed.length), [changed.length, onUnsavedChange]);

  function setCell(studentId: string, patch: Partial<{ rating: ConductRating | ''; comment: string }>) {
    setMessage(null);
    setDraft((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? empty), ...patch } }));
  }

  async function saveAll() {
    if (changed.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await reportCardsApi.saveSheet({
        classId,
        term,
        entries: changed.map((s) => {
          const d = draft[s._id] ?? empty;
          return { studentId: s._id, conductRating: d.rating, teacherComment: d.comment };
        }),
      });
      setMessage(`Saved conduct and comments for ${changed.length} student${changed.length === 1 ? '' : 's'}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save conduct and comments');
    } finally {
      setBusy(false);
    }
  }

  if (roster.length === 0) return <p className="info-card-empty">This class has no students yet.</p>;

  return (
    <div>
      <p className="info-card-sub mb-3">
        One conduct rating and comment per student for this term. Parents see them on the result card once results are
        released.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      <div className="table-scroll">
        <table className="data-table score-sheet">
          <thead>
            <tr>
              <th>Student</th>
              <th>Conduct</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="empty-cell">
                  Loading…
                </td>
              </tr>
            ) : (
              [...roster].sort(byName).map((s) => {
                const d = draft[s._id] ?? empty;
                const isChanged = changed.includes(s);
                return (
                  <tr key={s._id} className={isChanged ? 'row-changed' : undefined}>
                    <td>
                      {s.name}
                      {isChanged && <div className="text-xs text-amber-700">Not saved yet</div>}
                    </td>
                    <td>
                      <select
                        value={d.rating}
                        onChange={(e) => setCell(s._id, { rating: e.target.value as ConductRating | '' })}
                        aria-label={`Conduct for ${s.name}`}
                      >
                        <option value="">— Not set —</option>
                        {CONDUCT_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="w-full">
                      <input
                        value={d.comment}
                        onChange={(e) => setCell(s._id, { comment: e.target.value })}
                        placeholder="e.g. Doing very well this term"
                        maxLength={500}
                        className="w-full min-w-[200px]"
                        aria-label={`Comment for ${s.name}`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="save-bar">
        <span className="text-sm text-ink-soft">
          {changed.length === 0 ? 'All changes saved.' : `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex gap-2">
          {changed.length > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setDraft(saved)} disabled={busy}>
              Undo changes
            </button>
          )}
          <button type="button" onClick={saveAll} disabled={busy || changed.length === 0}>
            {busy ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function GradesPage() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [term, setTerm] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [tab, setTab] = useState<'scores' | 'conduct'>('scores');
  const [unsaved, setUnsaved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useWarnOnLeave(unsaved);

  useEffect(() => {
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        if (cs.length > 0) setSelectedClassId(cs[0]._id);
      })
      .catch((err) => setError(err.message));
    subjectsApi.list().then(setSubjectList).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (school && !term) setTerm(school.currentTerm);
  }, [school, term]);

  useEffect(() => {
    if (!selectedClassId) return;
    studentsApi
      .list()
      .then((all) => setRoster(all.filter((s) => s.classId === selectedClassId).sort(byName)))
      .catch((err) => setError(err.message));
  }, [selectedClassId]);

  const selectedClass = classList.find((c) => c._id === selectedClassId);
  const isFormTeacher = !!(selectedClass && user && (user.role === 'admin' || selectedClass.formTeacherId === user.id));

  // The form teacher (or admin) grades every subject on the class; a subject
  // teacher sees only the subjects assigned to them.
  const subjectOptions = useMemo(() => {
    if (!selectedClass || !user) return [];
    const names = new Map(subjectList.map((s) => [s._id, s.name]));
    return selectedClass.subjects
      .filter((cs) => isFormTeacher || cs.teacherId === user.id)
      .filter((cs) => names.has(cs.subjectId))
      .map((cs) => ({ id: cs.subjectId, name: names.get(cs.subjectId)! }));
  }, [selectedClass, user, subjectList, isFormTeacher]);

  useEffect(() => {
    setSubjectId((current) => (subjectOptions.some((s) => s.id === current) ? current : subjectOptions[0]?.id ?? ''));
  }, [subjectOptions]);

  useEffect(() => {
    if (!isFormTeacher) setTab('scores');
  }, [isFormTeacher]);

  const subject = subjectOptions.find((s) => s.id === subjectId);

  // Switching what's on screen would throw away typed scores, so ask first.
  function guarded<T>(set: (v: T) => void) {
    return (value: T) => {
      if (!confirmDiscard(unsaved)) return;
      setUnsaved(0);
      set(value);
    };
  }

  useHelpFacts([
    classList.length === 0 && 'This user is not attached to any class yet',
    selectedClass && `Selected class: ${selectedClass.name}`,
    selectedClass &&
      (user?.role === 'admin'
        ? 'User is the school admin'
        : isFormTeacher
          ? 'User is the form teacher of this class'
          : 'User is a subject teacher on this class (not the form teacher)'),
    term && school && `Selected term: ${term}${term === school.currentTerm ? ' (the current term)' : ' (not the current term)'}`,
    selectedClass && selectedClass.subjects.length === 0 && 'This class has no subjects yet, so no grades can be entered',
    selectedClass && selectedClass.subjects.length > 0 && subjectOptions.length === 0 && 'This user has no subject to grade on this class',
    subjectOptions.length > 0 && `Subjects this user can grade here: ${subjectOptions.map((s) => s.name).join(', ')}`,
    subject && tab === 'scores' && `The score sheet for ${subject.name} is open`,
    tab === 'conduct' && 'The conduct & comments sheet is open',
    selectedClass && `Students in this class: ${roster.length}`,
    unsaved > 0 && `There are ${unsaved} unsaved changes on screen`,
  ]);

  const noSubjects = selectedClass && selectedClass.subjects.length === 0;

  return (
    <div>
      <h1>Grades</h1>
      <p className="page-subtitle">
        Choose a class, term and subject. Every student is listed — type their CA and exam scores, then click Save all.
      </p>

      <div className="inline-form">
        <label className="filter-field">
          <span>Class</span>
          <select value={selectedClassId} onChange={(e) => guarded(setSelectedClassId)(e.target.value)}>
            {classList.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Term</span>
          <TermSelect school={school} value={term} onChange={guarded(setTerm)} />
        </label>
        {tab === 'scores' && subjectOptions.length > 0 && (
          <label className="filter-field">
            <span>Subject</span>
            <select value={subjectId} onChange={(e) => guarded(setSubjectId)(e.target.value)}>
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {isFormTeacher && (
        <div className="tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'scores'}
            className={tab === 'scores' ? 'tab tab-active' : 'tab'}
            onClick={() => guarded(setTab)('scores')}
          >
            Scores
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'conduct'}
            className={tab === 'conduct' ? 'tab tab-active' : 'tab'}
            onClick={() => guarded(setTab)('conduct')}
          >
            Conduct &amp; comments
          </button>
        </div>
      )}

      <div className="card">
        {!selectedClass ? (
          <p className="info-card-empty">You aren't assigned to any class yet. Ask the school admin to add you to a class.</p>
        ) : tab === 'conduct' ? (
          term && <ConductSheet classId={selectedClass._id} term={term} roster={roster} onUnsavedChange={setUnsaved} />
        ) : noSubjects ? (
          <p className="error">
            {selectedClass.name} has no subjects yet, so scores can't be entered.{' '}
            {user?.role === 'admin' ? (
              <Link to="/classes">Add subjects to this class →</Link>
            ) : (
              'Ask the school admin to add subjects to this class.'
            )}
          </p>
        ) : !subject ? (
          <p className="info-card-empty">You don't teach a subject on this class.</p>
        ) : (
          term &&
          school && (
            <ScoreSheet
              classId={selectedClass._id}
              subject={subject}
              term={term}
              roster={roster}
              scale={school.gradingScale}
              onUnsavedChange={setUnsaved}
            />
          )
        )}
      </div>
    </div>
  );
}
