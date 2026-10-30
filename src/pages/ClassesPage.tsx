import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { classes as classesApi, subjects as subjectsApi, users as usersApi } from '../api/resources';
import { ClassSubject, SchoolClass, Subject, UserAccount } from '../api/types';

export default function ClassesPage() {
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<UserAccount[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Subject editor for one class at a time: subjectId -> teacherId ('' = form teacher).
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Map<string, string>>(new Map());

  function refresh() {
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    usersApi.listTeachers().then(setTeachers).catch((err) => setError(err.message));
    subjectsApi.list().then(setSubjectList).catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await classesApi.create({ name, formTeacherId });
      setName('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
    }
  }

  async function handleChangeFormTeacher(classId: string, newTeacherId: string) {
    setError(null);
    try {
      await classesApi.setFormTeacher(classId, newTeacherId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change form teacher');
    }
  }

  function openSubjectEditor(c: SchoolClass) {
    setEditingClassId(c._id);
    setDraft(new Map(c.subjects.map((s) => [s.subjectId, s.teacherId ?? ''])));
    setSuccess(null);
  }

  function toggleDraftSubject(subjectId: string) {
    const next = new Map(draft);
    if (next.has(subjectId)) next.delete(subjectId);
    else next.set(subjectId, '');
    setDraft(next);
  }

  async function saveSubjects() {
    if (!editingClassId) return;
    setError(null);
    // Keep the school's subject order so the class list reads the same everywhere.
    const subjects: ClassSubject[] = subjectList
      .filter((s) => draft.has(s._id))
      .map((s) => ({ subjectId: s._id, ...(draft.get(s._id) ? { teacherId: draft.get(s._id) } : {}) }));
    try {
      await classesApi.setSubjects(editingClassId, subjects);
      setSuccess('Class subjects saved.');
      setEditingClassId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save class subjects');
    }
  }

  function teacherNameFor(id: string) {
    return teachers.find((t) => t._id === id)?.name ?? id;
  }

  function subjectNameFor(id: string) {
    return subjectList.find((s) => s._id === id)?.name ?? 'Unknown subject';
  }

  const editingClass = classList.find((c) => c._id === editingClassId);
  const activeSubjects = subjectList.filter((s) => s.isActive);

  return (
    <div>
      <h1>Classes</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Class name (e.g. JSS1 Gold)" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={formTeacherId} onChange={(e) => setFormTeacherId(e.target.value)} required>
          <option value="" disabled>
            Select form teacher
          </option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit">Add class</button>
      </form>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Form Teacher</th>
              <th>Subjects</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classList.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>
                  <select value={c.formTeacherId} onChange={(e) => handleChangeFormTeacher(c._id, e.target.value)}>
                    {!teachers.some((t) => t._id === c.formTeacherId) && (
                      <option value={c.formTeacherId} disabled>
                        Select form teacher
                      </option>
                    )}
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {c.subjects.length === 0 ? (
                    <span className="text-red-600 text-sm">No subjects — teachers can't enter grades yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.subjects.map((s) => (
                        <span key={s.subjectId} className="role-chip">
                          {subjectNameFor(s.subjectId)}
                          {s.teacherId && ` · ${teacherNameFor(s.teacherId)}`}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => openSubjectEditor(c)}>
                    Manage subjects
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingClass && (
        <div className="card mt-6">
          <h2>Subjects for {editingClass.name}</h2>
          <p className="info-card-sub mb-3">
            Tick the subjects this class takes. Leave the teacher as "Form teacher" when{' '}
            {teacherNameFor(editingClass.formTeacherId)} teaches it; pick a subject teacher otherwise. Subject teachers
            can only grade their own subject.
          </p>

          {activeSubjects.length === 0 ? (
            <p className="info-card-empty">
              The school has no subjects yet. <Link to="/subjects">Add subjects first →</Link>
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Takes it</th>
                    <th>Subject</th>
                    <th>Taught by</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubjects.map((s) => {
                    const checked = draft.has(s._id);
                    return (
                      <tr key={s._id}>
                        <td>
                          <input type="checkbox" checked={checked} onChange={() => toggleDraftSubject(s._id)} aria-label={s.name} />
                        </td>
                        <td>{s.name}</td>
                        <td>
                          <select
                            value={draft.get(s._id) ?? ''}
                            disabled={!checked}
                            onChange={(e) => setDraft(new Map(draft).set(s._id, e.target.value))}
                          >
                            <option value="">Form teacher ({teacherNameFor(editingClass.formTeacherId)})</option>
                            {teachers
                              .filter((t) => t._id !== editingClass.formTeacherId)
                              .map((t) => (
                                <option key={t._id} value={t._id}>
                                  {t.name}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={saveSubjects} disabled={activeSubjects.length === 0}>
              Save subjects
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingClassId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
