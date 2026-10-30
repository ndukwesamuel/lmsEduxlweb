import { FormEvent, useEffect, useMemo, useState } from 'react';
import { classes as classesApi, subjects as subjectsApi } from '../api/resources';
import { SchoolClass, Subject } from '../api/types';

// Quick-add suggestions for a Nigerian nursery / primary / secondary school.
const COMMON_SUBJECTS = [
  'English Language',
  'Mathematics',
  'Basic Science',
  'Basic Technology',
  'Social Studies',
  'Civic Education',
  'Christian Religious Studies',
  'Islamic Religious Studies',
  'Computer Studies',
  'Agricultural Science',
  'Home Economics',
  'Cultural and Creative Arts',
  'Physical and Health Education',
  'French',
  'Yoruba',
  'Igbo',
  'Hausa',
  'Numeracy',
  'Literacy',
  'Phonics',
  'Rhymes',
  'Writing',
];

export default function SubjectsPage() {
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    subjectsApi.list().then(setSubjectList).catch((err) => setError(err.message));
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  // How many classes take each subject, so the admin sees what a change affects.
  const classCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of classList) for (const s of c.subjects) counts.set(s.subjectId, (counts.get(s.subjectId) ?? 0) + 1);
    return counts;
  }, [classList]);

  const existingNames = new Set(subjectList.map((s) => s.name.toLowerCase()));
  const suggestions = COMMON_SUBJECTS.filter((n) => !existingNames.has(n.toLowerCase()));

  async function addSubject(subjectName: string, subjectCode?: string) {
    setError(null);
    setSuccess(null);
    try {
      const created = await subjectsApi.create({ name: subjectName, code: subjectCode || undefined });
      setSuccess(`${created.name} added. Add it to classes on the Classes page.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subject');
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await addSubject(name, code);
    setName('');
    setCode('');
  }

  async function saveRename(subject: Subject) {
    setError(null);
    setSuccess(null);
    try {
      await subjectsApi.update(subject._id, { name: editName });
      setEditingId(null);
      setSuccess('Subject renamed. Existing results now show the new name.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename subject');
    }
  }

  async function toggleActive(subject: Subject) {
    const used = classCount.get(subject._id) ?? 0;
    if (
      subject.isActive &&
      !window.confirm(
        `Deactivate ${subject.name}? It will be removed from ${used} class${used === 1 ? '' : 'es'} and can no longer be graded. Grades already entered are kept.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await subjectsApi.update(subject._id, { isActive: !subject.isActive });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subject');
    }
  }

  return (
    <div>
      <h1>Subjects</h1>
      <p className="page-subtitle">
        The school's list of subjects. Add them here, then choose which subjects each class takes on the Classes page.
      </p>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Subject name (e.g. Mathematics)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Code (optional, e.g. MTH)" value={code} onChange={(e) => setCode(e.target.value)} className="w-48" />
        <button type="submit">Add subject</button>
      </form>

      {suggestions.length > 0 && (
        <div className="mb-5">
          <p className="info-card-sub mb-2">Quick add common subjects:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((n) => (
              <button key={n} type="button" className="chip-button" onClick={() => addSubject(n)}>
                + {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Code</th>
              <th>Classes</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subjectList.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No subjects yet. Add the subjects your school teaches above.
                </td>
              </tr>
            )}
            {subjectList.map((s) => (
              <tr key={s._id}>
                <td>
                  {editingId === s._id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  ) : (
                    s.name
                  )}
                </td>
                <td>{s.code ?? '—'}</td>
                <td>{classCount.get(s._id) ?? 0}</td>
                <td>
                  <span className={`status-badge ${s.isActive ? 'status-Active' : 'status-Withdrawn'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    {editingId === s._id ? (
                      <>
                        <button type="button" onClick={() => saveRename(s)}>
                          Save
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingId(s._id);
                          setEditName(s.name);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => toggleActive(s)}>
                      {s.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
