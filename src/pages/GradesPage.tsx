import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  classes as classesApi,
  grades as gradesApi,
  reportCards as reportCardsApi,
  students as studentsApi,
  subjects as subjectsApi,
} from '../api/resources';
import { ConductRating, Grade, SchoolClass, Student, Subject } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import TermSelect from '../components/TermSelect';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';

const CONDUCT_OPTIONS: ConductRating[] = ['Excellent', 'Good', 'Fair', 'Needs Improvement'];

export default function GradesPage() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [term, setTerm] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [entries, setEntries] = useState<Grade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Conduct + comment (form teacher / admin only, one per student per term).
  const [conductStudentId, setConductStudentId] = useState('');
  const [conductRating, setConductRating] = useState<ConductRating>('Good');
  const [teacherComment, setTeacherComment] = useState('');
  const [conductSuccess, setConductSuccess] = useState<string | null>(null);

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

  function refreshGrades() {
    if (!selectedClassId || !term) return;
    gradesApi.list({ classId: selectedClassId, term }).then(setEntries).catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!selectedClassId) return;
    studentsApi
      .list()
      .then((all) => setRoster(all.filter((s) => s.classId === selectedClassId)))
      .catch((err) => setError(err.message));
    setStudentId('');
    setConductStudentId('');
  }, [selectedClassId]);

  useEffect(() => {
    refreshGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, term]);

  // If this student already has a grade for the subject, load it so the
  // teacher edits it rather than overwriting it blind.
  const existing = entries.find((g) => g.studentId === studentId && g.subjectId === subjectId);
  useEffect(() => {
    setCaScore(existing ? String(existing.caScore) : '');
    setExamScore(existing ? String(existing.examScore) : '');
    setSuccess(null);
  }, [existing?._id, studentId, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load any saved conduct/comment for the chosen student.
  useEffect(() => {
    setConductSuccess(null);
    if (!conductStudentId || !term) return;
    reportCardsApi
      .get(conductStudentId, term)
      .then((card) => {
        setConductRating(card.conductRating ?? 'Good');
        setTeacherComment(card.teacherComment ?? '');
      })
      .catch((err) => setError(err.message));
  }, [conductStudentId, term]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await gradesApi.post({
        studentId,
        classId: selectedClassId,
        subjectId,
        term,
        caScore: Number(caScore),
        examScore: Number(examScore),
      });
      setSuccess(existing ? 'Grade updated.' : 'Grade saved.');
      refreshGrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grade');
    }
  }

  async function handleConductSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConductSuccess(null);
    try {
      await reportCardsApi.setConduct({
        studentId: conductStudentId,
        classId: selectedClassId,
        term,
        conductRating,
        teacherComment,
      });
      setConductSuccess('Conduct and comment saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save conduct/comment');
    }
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
    selectedClass && `Students in this class: ${roster.length}`,
    selectedClass && `Grades already entered for this class and term: ${entries.length}`,
  ]);

  function studentName(id: string) {
    return roster.find((s) => s._id === id)?.name ?? id;
  }

  const sortedEntries = [...entries].sort(
    (a, b) => studentName(a.studentId).localeCompare(studentName(b.studentId)) || a.subject.localeCompare(b.subject)
  );

  return (
    <div>
      <h1>Grades</h1>
      <p className="page-subtitle">Subject-based result sheet — continuous assessment and exam scores, per subject, per term.</p>

      <div className="inline-form">
        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} aria-label="Class">
          {classList.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <TermSelect school={school} value={term} onChange={setTerm} />
      </div>

      {selectedClass && selectedClass.subjects.length === 0 ? (
        <p className="error">
          {selectedClass.name} has no subjects yet, so grades can't be entered.{' '}
          {user?.role === 'admin' ? (
            <Link to="/classes">Add subjects to this class →</Link>
          ) : (
            'Ask the school admin to add subjects to this class.'
          )}
        </p>
      ) : subjectOptions.length === 0 ? (
        <p>You don't teach a subject on this class.</p>
      ) : (
        <form className="inline-form" onSubmit={handleSubmit}>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required aria-label="Student">
            <option value="" disabled>
              Select student
            </option>
            {roster.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={40}
            placeholder="CA (0-40)"
            value={caScore}
            onChange={(e) => setCaScore(e.target.value)}
            className="w-32"
            required
          />
          <input
            type="number"
            min={0}
            max={60}
            placeholder="Exam (0-60)"
            value={examScore}
            onChange={(e) => setExamScore(e.target.value)}
            className="w-32"
            required
          />
          <button type="submit">{existing ? 'Update grade' : 'Save grade'}</button>
        </form>
      )}
      {existing && !success && (
        <p className="info-card-sub mb-3">
          {studentName(existing.studentId)} already has {existing.total} ({existing.letterGrade}) in {existing.subject}. Saving
          will replace it.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>CA Score</th>
              <th>Exam Score</th>
              <th>Total</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No grades entered yet for this class and term.
                </td>
              </tr>
            )}
            {sortedEntries.map((g) => (
              <tr key={g._id}>
                <td>{studentName(g.studentId)}</td>
                <td>{g.subject}</td>
                <td>{g.caScore}</td>
                <td>{g.examScore}</td>
                <td>{g.total}</td>
                <td>
                  <span className={`status-badge grade-${g.letterGrade}`}>{g.letterGrade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormTeacher && (
        <div className="card mt-8">
          <h2>Conduct &amp; comment</h2>
          <p className="page-subtitle">Set once per student per term — visible to the parent on the full result card.</p>
          <form className="inline-form" onSubmit={handleConductSubmit}>
            <select value={conductStudentId} onChange={(e) => setConductStudentId(e.target.value)} required aria-label="Student">
              <option value="" disabled>
                Select student
              </option>
              {roster.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={conductRating} onChange={(e) => setConductRating(e.target.value as ConductRating)} aria-label="Conduct">
              {CONDUCT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="Comment, e.g. 'Doing exceptionally well this term'"
              className="flex-1 min-w-[240px]"
            />
            <button type="submit">Save</button>
          </form>
          {conductSuccess && <p className="success">{conductSuccess}</p>}
        </div>
      )}
    </div>
  );
}
