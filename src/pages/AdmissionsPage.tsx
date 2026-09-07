import { FormEvent, useEffect, useState } from 'react';
import { admissions as admissionsApi, classes as classesApi } from '../api/resources';
import { Admission, AdmissionStatus, SchoolClass } from '../api/types';

const TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  Applied: ['Reviewed', 'Withdrawn'],
  Reviewed: ['Interview', 'Rejected', 'Withdrawn'],
  Interview: ['Approved', 'Not Admitted', 'Withdrawn'],
  Approved: ['Registered', 'Withdrawn'],
  Registered: ['Active', 'Withdrawn'],
  Active: [],
  Rejected: [],
  'Not Admitted': [],
  Withdrawn: [],
};

export default function AdmissionsPage() {
  const [list, setList] = useState<Admission[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [applicantName, setApplicantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<{ id: string; classId: string; dob: string } | null>(null);

  function refresh() {
    admissionsApi.list().then(setList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    classesApi.list().then(setClassList).catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await admissionsApi.create(applicantName);
      setApplicantName('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create applicant');
    }
  }

  async function handleTransition(admission: Admission, newStatus: AdmissionStatus) {
    setError(null);
    if (newStatus === 'Active') {
      setActiveTarget({ id: admission._id, classId: '', dob: '' });
      return;
    }
    try {
      await admissionsApi.transition(admission._id, newStatus);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  async function confirmActiveTransition(e: FormEvent) {
    e.preventDefault();
    if (!activeTarget) return;
    setError(null);
    try {
      await admissionsApi.transition(activeTarget.id, 'Active', {
        classId: activeTarget.classId,
        dob: activeTarget.dob,
      });
      setActiveTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  return (
    <div>
      <h1>Admissions</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          placeholder="Applicant name"
          value={applicantName}
          onChange={(e) => setApplicantName(e.target.value)}
          required
        />
        <button type="submit">New applicant</button>
      </form>
      {error && <p className="error">{error}</p>}

      {activeTarget && (
        <form className="inline-form" onSubmit={confirmActiveTransition}>
          <span>Enrolling — pick class and DOB:</span>
          <select
            value={activeTarget.classId}
            onChange={(e) => setActiveTarget({ ...activeTarget, classId: e.target.value })}
            required
          >
            <option value="" disabled>
              Select class
            </option>
            {classList.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={activeTarget.dob}
            onChange={(e) => setActiveTarget({ ...activeTarget, dob: e.target.value })}
            required
          />
          <button type="submit">Confirm enrollment</button>
          <button type="button" onClick={() => setActiveTarget(null)}>
            Cancel
          </button>
        </form>
      )}

      <div className="table-scroll">
        <table className="data-table fit-columns">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a._id}>
                <td>{a.applicantName}</td>
                <td>
                  <span className={`status-badge status-${a.status.replace(/\s+/g, '')}`}>{a.status}</span>
                </td>
                <td>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-1.5">
                    {TRANSITIONS[a.status].map((next) => (
                      <button key={next} onClick={() => handleTransition(a, next)}>
                        {next}
                      </button>
                    ))}
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
