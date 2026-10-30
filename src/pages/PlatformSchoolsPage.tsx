import { FormEvent, useEffect, useState } from 'react';
import { platform as platformApi } from '../api/resources';
import { PlatformSchool } from '../api/types';

export default function PlatformSchoolsPage() {
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    platformApi.listSchools().then(setSchools).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const created = await platformApi.createSchool({
        name,
        code,
        address: address || undefined,
        adminName,
        adminEmail,
        adminPassword,
      });
      setSuccess(`${created.name} created. Its admin can now log in as ${adminEmail.toLowerCase()}.`);
      setName('');
      setCode('');
      setAddress('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create school');
    }
  }

  async function handleToggle(school: PlatformSchool) {
    const action = school.isActive ? 'Suspend' : 'Reactivate';
    const note = school.isActive
      ? ' Its admin, teachers and parents will be logged out and unable to log in, and its apply link will stop working. No data is deleted.'
      : ' Its users will be able to log in again.';
    if (!window.confirm(`${action} ${school.name}?${note}`)) return;
    setError(null);
    setSuccess(null);
    try {
      await platformApi.updateSchool(school._id, { isActive: !school.isActive });
      setSuccess(`${school.name} has been ${school.isActive ? 'suspended' : 'reactivated'}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update school');
    }
  }

  const active = schools.filter((s) => s.isActive);
  const totalStudents = schools.reduce((sum, s) => sum + s.students, 0);

  return (
    <div>
      <h1>Schools</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Schools</span>
          <span className="stat-value">{schools.length}</span>
          <span className="stat-sub">{active.length} active</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Students</span>
          <span className="stat-value">{totalStudents}</span>
          <span className="stat-sub">across all schools</span>
        </div>
      </div>

      <h2>Add a school</h2>
      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          placeholder="Code (e.g. ILA)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={10}
          required
        />
        <input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input placeholder="Admin full name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
        <input
          type="email"
          placeholder="Admin email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Admin temporary password (8+ chars)"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          minLength={8}
          required
        />
        <button type="submit">Create school</button>
      </form>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <h2 className="mt-6">All schools</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>School</th>
              <th>Code</th>
              <th>Apply link</th>
              <th>Students</th>
              <th>Teachers</th>
              <th>Parents</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
                  No schools yet.
                </td>
              </tr>
            ) : (
              schools.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.code}</td>
                  <td>/apply/{s.slug}</td>
                  <td>{s.students}</td>
                  <td>{s.teachers}</td>
                  <td>{s.parents}</td>
                  <td>
                    <span className={`status-badge ${s.isActive ? 'status-Active' : 'status-Rejected'}`}>
                      {s.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>
                    <button type="button" onClick={() => handleToggle(s)}>
                      {s.isActive ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
