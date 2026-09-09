import { FormEvent, useEffect, useState } from 'react';
import { students as studentsApi, classes as classesApi, users as usersApi, reportCards as reportCardsApi } from '../api/resources';
import { FullResultCard, SchoolClass, Student, UserAccount } from '../api/types';

const DEFAULT_TERM = '2026 Term 1';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [parents, setParents] = useState<UserAccount[]>([]);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewTerm, setViewTerm] = useState(DEFAULT_TERM);
  const [resultCard, setResultCard] = useState<FullResultCard | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);

  function refresh() {
    studentsApi.list().then(setStudents).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
    usersApi.listParents().then(setParents).catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await studentsApi.create({ name, dob, classId });
      setName('');
      setDob('');
      setClassId('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    }
  }

  async function handleWithdraw(id: string) {
    await studentsApi.remove(id);
    refresh();
  }

  async function handleLinkGuardian(studentId: string, guardianUserId: string) {
    setLinkingId(null);
    if (!guardianUserId) return;
    await studentsApi.update(studentId, { guardianUserId });
    refresh();
  }

  function classNameFor(id: string) {
    return classList.find((c) => c._id === id)?.name ?? id;
  }

  function parentNameFor(id?: string) {
    if (!id) return null;
    return parents.find((p) => p._id === id)?.name ?? 'Unknown';
  }

  function loadResultCard(studentId: string, term: string) {
    setCardError(null);
    reportCardsApi
      .get(studentId, term)
      .then((card) => {
        setResultCard(card);
        setRemarkDraft(card.adminRemark ?? '');
      })
      .catch((err) => setCardError(err instanceof Error ? err.message : 'Failed to load result card'));
  }

  function openResultCard(studentId: string) {
    setViewingId(studentId);
    setResultCard(null);
    loadResultCard(studentId, viewTerm);
  }

  async function saveRemark() {
    if (!viewingId) return;
    try {
      await reportCardsApi.setAdminRemark(viewingId, viewTerm, remarkDraft);
      loadResultCard(viewingId, viewTerm);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to save remark');
    }
  }

  return (
    <div>
      <h1>Students</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
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
        <button type="submit">Add student</button>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>DOB</th>
              <th>Class</th>
              <th>Guardian</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{new Date(s.dob).toLocaleDateString()}</td>
                <td>{classNameFor(s.classId)}</td>
                <td>
                  {linkingId === s._id ? (
                    <select autoFocus onChange={(e) => handleLinkGuardian(s._id, e.target.value)} onBlur={() => setLinkingId(null)}>
                      <option value="">Select parent</option>
                      {parents.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : parentNameFor(s.guardianUserId) ? (
                    <span onClick={() => setLinkingId(s._id)} className="cursor-pointer">
                      {parentNameFor(s.guardianUserId)}
                    </span>
                  ) : (
                    <button onClick={() => setLinkingId(s._id)}>Link guardian</button>
                  )}
                </td>
                <td>{s.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-1.5">
                    <button type="button" className="!bg-stone-100 !text-ink hover:!bg-stone-200" onClick={() => openResultCard(s._id)}>
                      Result card
                    </button>
                    {s.isActive && <button onClick={() => handleWithdraw(s._id)}>Deactivate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingId && (
        <div className="card mt-6">
          <div className="info-card-top mb-2">
            <h2 className="!mb-0">Result card — {students.find((s) => s._id === viewingId)?.name}</h2>
            <button type="button" className="!bg-stone-100 !text-ink hover:!bg-stone-200" onClick={() => setViewingId(null)}>
              Close
            </button>
          </div>
          <div className="inline-form">
            <input value={viewTerm} onChange={(e) => setViewTerm(e.target.value)} placeholder="Term" />
            <button type="button" onClick={() => loadResultCard(viewingId, viewTerm)}>
              Load
            </button>
          </div>
          {cardError && <p className="error">{cardError}</p>}
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
                  <div className="stat-value-sm">
                    {resultCard.conductRating ? (
                      <span className={`status-badge conduct-${resultCard.conductRating.replace(' ', '')}`}>{resultCard.conductRating}</span>
                    ) : (
                      '—'
                    )}
                  </div>
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inline-form mt-4">
                <input
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  placeholder="Admin remark, e.g. 'Approved for promotion'"
                  className="flex-1 min-w-[240px]"
                />
                <button type="button" onClick={saveRemark}>
                  Save remark
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
