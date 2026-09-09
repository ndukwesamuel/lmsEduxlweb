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
  const [activeTarget, setActiveTarget] = useState<{ id: string; classId: string; dob: string; feeAmount: string } | null>(
    null
  );
  const [contactTarget, setContactTarget] = useState<{
    id: string;
    guardianName: string;
    guardianPhone: string;
    guardianEmail: string;
  } | null>(null);

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
      setActiveTarget({ id: admission._id, classId: '', dob: '', feeAmount: '' });
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
        feeAmount: activeTarget.feeAmount ? Number(activeTarget.feeAmount) : undefined,
      });
      setActiveTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  function openContactEditor(a: Admission) {
    setContactTarget({
      id: a._id,
      guardianName: a.guardianName ?? '',
      guardianPhone: a.guardianPhone ?? '',
      guardianEmail: a.guardianEmail ?? '',
    });
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    if (!contactTarget) return;
    setError(null);
    try {
      await admissionsApi.updateContact(contactTarget.id, {
        guardianName: contactTarget.guardianName || undefined,
        guardianPhone: contactTarget.guardianPhone || undefined,
        guardianEmail: contactTarget.guardianEmail || undefined,
      });
      setContactTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact details');
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

      {contactTarget && (
        <form className="inline-form" onSubmit={saveContact}>
          <span>Guardian contact:</span>
          <input
            placeholder="Guardian name"
            value={contactTarget.guardianName}
            onChange={(e) => setContactTarget({ ...contactTarget, guardianName: e.target.value })}
          />
          <input
            placeholder="Phone"
            value={contactTarget.guardianPhone}
            onChange={(e) => setContactTarget({ ...contactTarget, guardianPhone: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            value={contactTarget.guardianEmail}
            onChange={(e) => setContactTarget({ ...contactTarget, guardianEmail: e.target.value })}
          />
          <button type="submit">Save contact</button>
          <button type="button" onClick={() => setContactTarget(null)}>
            Cancel
          </button>
        </form>
      )}

      {activeTarget && (
        <form className="inline-form" onSubmit={confirmActiveTransition}>
          <span>Enrolling — class, DOB, and fee:</span>
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
          <input
            type="number"
            min={0}
            placeholder="Fee (₦, optional)"
            value={activeTarget.feeAmount}
            onChange={(e) => setActiveTarget({ ...activeTarget, feeAmount: e.target.value })}
            className="w-40"
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
              <th>Guardian contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a._id}>
                <td>{a.applicantName}</td>
                <td>
                  {a.guardianName || a.guardianPhone || a.guardianEmail ? (
                    <div className="text-xs text-ink-soft">
                      {a.guardianName && <div>{a.guardianName}</div>}
                      {a.guardianPhone && <div>{a.guardianPhone}</div>}
                      {a.guardianEmail && <div>{a.guardianEmail}</div>}
                    </div>
                  ) : (
                    <span className="info-card-empty">Not on file</span>
                  )}
                  <button type="button" className="!bg-stone-100 !text-ink hover:!bg-stone-200 mt-1" onClick={() => openContactEditor(a)}>
                    Edit
                  </button>
                </td>
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
