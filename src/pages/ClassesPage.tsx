import { FormEvent, useEffect, useState } from 'react';
import { classes as classesApi, users as usersApi } from '../api/resources';
import { SchoolClass, UserAccount } from '../api/types';

export default function ClassesPage() {
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<UserAccount[]>([]);
  const [name, setName] = useState('');
  const [term, setTerm] = useState('2026 Term 1');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    usersApi.listTeachers().then(setTeachers).catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await classesApi.create({ name, term, formTeacherId });
      setName('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
    }
  }

  function teacherNameFor(id: string) {
    return teachers.find((t) => t._id === id)?.name ?? id;
  }

  return (
    <div>
      <h1>Classes</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Class name (e.g. JSS1 Gold)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Term" value={term} onChange={(e) => setTerm(e.target.value)} required />
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

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Term</th>
              <th>Form Teacher</th>
              <th>Subject Teachers</th>
            </tr>
          </thead>
          <tbody>
            {classList.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>{c.term}</td>
                <td>{teacherNameFor(c.formTeacherId)}</td>
                <td>
                  {c.subjectTeachers.length === 0
                    ? '—'
                    : c.subjectTeachers.map((st) => `${teacherNameFor(st.teacherId)} (${st.subject})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
