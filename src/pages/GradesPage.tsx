import { FormEvent, useEffect, useMemo, useState } from 'react';
import { classes as classesApi, grades as gradesApi, students as studentsApi } from '../api/resources';
import { Grade, SchoolClass, Student } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const DEFAULT_TERM = '2026 Term 1';

export default function GradesPage() {
  const { user } = useAuth();
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [subject, setSubject] = useState('');
  const [studentId, setStudentId] = useState('');
  const [score, setScore] = useState('');
  const [entries, setEntries] = useState<Grade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        if (cs.length > 0) setSelectedClassId(cs[0]._id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const selectedClass = classList.find((c) => c._id === selectedClassId);

  const subjectOptions = useMemo(() => {
    if (!selectedClass || !user) return [];
    if (user.role === 'admin' || selectedClass.formTeacherId === user.id) {
      const fromSubjectTeachers = selectedClass.subjectTeachers.map((st) => st.subject);
      return fromSubjectTeachers.length > 0 ? fromSubjectTeachers : ['General Studies'];
    }
    return selectedClass.subjectTeachers.filter((st) => st.teacherId === user.id).map((st) => st.subject);
  }, [selectedClass, user]);

  useEffect(() => {
    if (subjectOptions.length > 0) setSubject(subjectOptions[0]);
  }, [subjectOptions]);

  function refreshGrades() {
    if (!selectedClassId) return;
    gradesApi.list({ classId: selectedClassId, term }).then(setEntries).catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!selectedClassId) return;
    studentsApi
      .list()
      .then((all) => setRoster(all.filter((s) => s.classId === selectedClassId)))
      .catch((err) => setError(err.message));
    refreshGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, term]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await gradesApi.post({ studentId, classId: selectedClassId, subject, term, score: Number(score) });
      setScore('');
      setSuccess('Grade saved.');
      refreshGrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grade');
    }
  }

  function studentName(id: string) {
    return roster.find((s) => s._id === id)?.name ?? id;
  }

  return (
    <div>
      <h1>Grades</h1>

      <div className="inline-form">
        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
          {classList.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
      </div>

      {subjectOptions.length === 0 ? (
        <p>You don't have a subject to grade on this class.</p>
      ) : (
        <form className="inline-form" onSubmit={handleSubmit}>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="" disabled>
              Select student
            </option>
            {roster.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Score (0-100)"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{ width: '140px' }}
            required
          />
          <button type="submit">Save grade</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Score</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((g) => (
              <tr key={g._id}>
                <td>{studentName(g.studentId)}</td>
                <td>{g.subject}</td>
                <td>{g.score}</td>
                <td>
                  <span className={`status-badge grade-${g.letterGrade}`}>{g.letterGrade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
