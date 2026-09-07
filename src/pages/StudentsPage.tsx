import { FormEvent, useEffect, useState } from 'react';
import { students as studentsApi, classes as classesApi, users as usersApi } from '../api/resources';
import { SchoolClass, Student, UserAccount } from '../api/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [parents, setParents] = useState<UserAccount[]>([]);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

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
                <td>{s.isActive && <button onClick={() => handleWithdraw(s._id)}>Deactivate</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
