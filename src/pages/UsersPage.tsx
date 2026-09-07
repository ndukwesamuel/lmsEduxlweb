import { FormEvent, useEffect, useState } from 'react';
import { users as usersApi } from '../api/resources';
import { UserAccount, UserRole } from '../api/types';

export default function UsersPage() {
  const [teachers, setTeachers] = useState<UserAccount[]>([]);
  const [parents, setParents] = useState<UserAccount[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Extract<UserRole, 'teacher' | 'parent'>>('teacher');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    usersApi.listTeachers().then(setTeachers).catch((err) => setError(err.message));
    usersApi.listParents().then(setParents).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await usersApi.create({ name, email, password, role });
      setSuccess(`${role === 'teacher' ? 'Teacher' : 'Parent'} account created.`);
      setName('');
      setEmail('');
      setPassword('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  }

  return (
    <div>
      <h1>Users</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Temporary password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Extract<UserRole, 'teacher' | 'parent'>)}>
          <option value="teacher">Teacher</option>
          <option value="parent">Parent</option>
        </select>
        <button type="submit">Create account</button>
      </form>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <h2>Teachers</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t._id}>
                <td>{t.name}</td>
                <td>{t.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6">Parents</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {parents.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
