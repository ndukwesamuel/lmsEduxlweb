import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { students as studentsApi, classes as classesApi, users as usersApi, reportCards as reportCardsApi } from '../api/resources';
import { FullResultCard, SchoolClass, Student, UserAccount } from '../api/types';
import TermSelect from '../components/TermSelect';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export default function StudentsPage() {
  const { school } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [parents, setParents] = useState<UserAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');

  // Add student
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [classId, setClassId] = useState('');
  const [guardianId, setGuardianId] = useState('');

  // Edit name / date of birth in place
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');

  // Result card
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewTerm, setViewTerm] = useState('');
  const [resultCard, setResultCard] = useState<FullResultCard | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (school && !viewTerm) setViewTerm(school.currentTerm);
  }, [school, viewTerm]);

  function refresh() {
    studentsApi.list().then(setStudents).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
    usersApi.listParents().then(setParents).catch((err) => setError(err.message));
  }, []);

  const classNameFor = (id: string) => classList.find((c) => c._id === id)?.name ?? '—';

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => !classFilter || s.classId === classFilter)
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => classNameFor(a.classId).localeCompare(classNameFor(b.classId)) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, classFilter, search, classList]);

  const withoutParent = students.filter((s) => !s.guardianUserId).length;

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const ok = await run(async () => {
      const created = await studentsApi.create({ name, dob, classId });
      if (guardianId) await studentsApi.update(created._id, { guardianUserId: guardianId });
    }, `${name.trim()} added to ${classNameFor(classId)}.`);
    if (ok) {
      // Keep the class picked so the next child in the same class is quick to add.
      setName('');
      setDob('');
      setGuardianId('');
    }
  }

  function changeClass(student: Student, newClassId: string) {
    if (newClassId === student.classId) return;
    if (!window.confirm(`Move ${student.name} from ${classNameFor(student.classId)} to ${classNameFor(newClassId)}?`)) return;
    run(() => studentsApi.update(student._id, { classId: newClassId }), `${student.name} moved to ${classNameFor(newClassId)}.`);
  }

  function changeParent(student: Student, parentId: string) {
    const parentName = parents.find((p) => p._id === parentId)?.name;
    run(
      () => studentsApi.update(student._id, { guardianUserId: parentId || null }),
      parentId ? `${student.name} is now linked to ${parentName}.` : `${student.name}'s parent was unlinked.`
    );
  }

  function startEdit(student: Student) {
    setEditingId(student._id);
    setEditName(student.name);
    setEditDob(toDateInput(student.dob));
  }

  async function saveEdit(student: Student) {
    const ok = await run(() => studentsApi.update(student._id, { name: editName, dob: editDob }), 'Student details saved.');
    if (ok) setEditingId(null);
  }

  function handleRemove(student: Student) {
    if (!window.confirm(`Remove ${student.name} from the student list? Their past records are kept.`)) return;
    if (viewingId === student._id) setViewingId(null);
    run(() => studentsApi.remove(student._id), `${student.name} removed.`);
  }

  // Result card: loads whenever the student or term changes.
  useEffect(() => {
    if (!viewingId || !viewTerm) return;
    setCardError(null);
    setResultCard(null);
    reportCardsApi
      .get(viewingId, viewTerm)
      .then((card) => {
        setResultCard(card);
        setRemarkDraft(card.adminRemark ?? '');
      })
      .catch((err) => setCardError(err instanceof Error ? err.message : 'Failed to load result card'));
  }, [viewingId, viewTerm]);

  function openResultCard(studentId: string) {
    setViewingId(studentId);
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function saveRemark() {
    if (!viewingId) return;
    try {
      await reportCardsApi.setAdminRemark(viewingId, viewTerm, remarkDraft);
      setCardError(null);
      setMessage('Admin remark saved.');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to save remark');
    }
  }

  useHelpFacts([
    `The school has ${students.length} student(s) in ${classList.length} class(es)`,
    classList.length === 0 && 'No classes exist yet — students need a class, so classes must be created first',
    parents.length === 0 && 'No parent accounts exist yet — they are created on the Users page',
    withoutParent > 0 && `${withoutParent} student(s) are not linked to a parent yet`,
  ]);

  const viewing = students.find((s) => s._id === viewingId);

  return (
    <div>
      <h1>Students</h1>
      <p className="page-subtitle">
        Change a student's class or parent straight from the list. Use Edit to fix a name or date of birth.
      </p>

      <div className="flex flex-wrap items-end gap-2.5 mb-4">
        <label className="filter-field">
          <span>Class</span>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sheet-input">
            <option value="">All classes</option>
            {classList.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field flex-1 min-w-[180px]">
          <span>Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" className="sheet-input" />
        </label>
        <button type="button" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Close' : '+ Add student'}
        </button>
      </div>

      {showAdd && (
        <form className="inline-form" onSubmit={handleCreate}>
          <label className="filter-field flex-1 min-w-[200px]">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="filter-field">
            <span>Date of birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
          </label>
          <label className="filter-field">
            <span>Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="" disabled>
                Select class
              </option>
              {classList.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Parent (optional)</span>
            <select value={guardianId} onChange={(e) => setGuardianId(e.target.value)}>
              <option value="">— Not linked —</option>
              {parents.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="self-end">
            Add student
          </button>
          {parents.length === 0 && (
            <p className="info-card-sub w-full">
              No parent accounts yet — <Link to="/users">create them on the Users page</Link>.
            </p>
          )}
        </form>
      )}

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      {viewing && (
        <div className="card mb-6" ref={cardRef}>
          <div className="info-card-top mb-3">
            <h2 className="!mb-0">Result card — {viewing.name}</h2>
            <button type="button" className="btn-secondary" onClick={() => setViewingId(null)}>
              Close
            </button>
          </div>
          <div className="mb-3">
            <TermSelect school={school} value={viewTerm} onChange={setViewTerm} className="sheet-input" />
          </div>
          {cardError && <p className="error">{cardError}</p>}
          {!resultCard && !cardError && <p className="info-card-empty">Loading…</p>}
          {resultCard && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <div className="stat-label">Attendance</div>
                  <div className="stat-value-sm">
                    {resultCard.attendance.attendanceRate === null ? '—' : `${resultCard.attendance.attendanceRate.toFixed(0)}%`}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Conduct</div>
                  <div className="stat-value-sm">{resultCard.conductRating ?? '—'}</div>
                </div>
                <div>
                  <div className="stat-label">Released to parent</div>
                  <div className="stat-value-sm">{resultCard.released ? 'Yes' : 'Not yet'}</div>
                </div>
              </div>
              {resultCard.teacherComment && (
                <p className="info-card-sub mb-3">
                  <strong className="text-ink">Teacher comment:</strong> &ldquo;{resultCard.teacherComment}&rdquo;
                </p>
              )}
              <div className="table-scroll">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>CA</th>
                      <th>Exam</th>
                      <th>Total</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultCard.subjects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          No grades for this term yet.
                        </td>
                      </tr>
                    )}
                    {resultCard.subjects.map((sub, i) => (
                      <tr key={i}>
                        <td>{sub.subject}</td>
                        <td>{sub.caScore}</td>
                        <td>{sub.examScore}</td>
                        <td>{sub.total}</td>
                        <td>
                          <span className={`status-badge grade-${sub.letterGrade}`}>{sub.letterGrade}</span>
                          {sub.remark && <span className="text-xs text-ink-soft ml-1.5">{sub.remark}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <input
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  placeholder="Admin remark, e.g. 'Promoted to the next class'"
                  className="sheet-input flex-1 min-w-[240px]"
                />
                <button type="button" onClick={saveRemark}>
                  Save remark
                </button>
              </div>
              <p className="info-card-sub mt-2">
                To write remarks for a whole class at once, use <Link to="/results">Results → Admin remarks</Link>.
              </p>
            </>
          )}
        </div>
      )}

      <p className="info-card-sub mb-2">
        Showing {shown.length} of {students.length} students
      </p>
      <div className="table-scroll">
        <table className="data-table score-sheet">
          <thead>
            <tr>
              <th>Name</th>
              <th>Date of birth</th>
              <th>Class</th>
              <th>Parent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  {students.length === 0 ? 'No students yet. Click "+ Add student" to add one.' : 'No students match.'}
                </td>
              </tr>
            )}
            {shown.map((s) => {
              const editing = editingId === s._id;
              return (
                <tr key={s._id} className={editing ? 'row-changed' : undefined}>
                  <td>
                    {editing ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Name" className="min-w-[180px]" />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} aria-label="Date of birth" />
                    ) : (
                      new Date(s.dob).toLocaleDateString()
                    )}
                  </td>
                  <td>
                    <select value={s.classId} onChange={(e) => changeClass(s, e.target.value)} aria-label={`Class for ${s.name}`}>
                      {classList.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={s.guardianUserId ?? ''}
                      onChange={(e) => changeParent(s, e.target.value)}
                      aria-label={`Parent for ${s.name}`}
                      className={s.guardianUserId ? undefined : 'text-ink-soft'}
                    >
                      <option value="">— Not linked —</option>
                      {parents.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {editing ? (
                        <>
                          <button type="button" onClick={() => saveEdit(s)}>
                            Save
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-secondary" onClick={() => startEdit(s)}>
                            Edit
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => openResultCard(s._id)}>
                            Result card
                          </button>
                          <button type="button" className="btn-danger-soft" onClick={() => handleRemove(s)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
