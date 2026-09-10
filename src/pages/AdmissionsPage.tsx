import { FormEvent, useEffect, useState } from 'react';
import { admissions as admissionsApi, classes as classesApi } from '../api/resources';
import { Admission, AdmissionStatus, GuardianDetails, RegistrationDetails, SchoolClass } from '../api/types';

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

const MAX_DOC_BYTES = 1_500_000;

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

const emptyGuardian: GuardianDetails = {};

function GuardianFields({
  label,
  value,
  onChange,
  withRelationship,
}: {
  label: string;
  value: GuardianDetails;
  onChange: (next: GuardianDetails) => void;
  withRelationship?: boolean;
}) {
  const set = (k: keyof GuardianDetails, v: string) => onChange({ ...value, [k]: v });
  return (
    <fieldset className="border border-stone-200 rounded-xl2 p-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft px-1">{label}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input placeholder="Name" value={value.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        <input placeholder="Profession" value={value.profession ?? ''} onChange={(e) => set('profession', e.target.value)} />
        <input placeholder="L.G.A." value={value.lga ?? ''} onChange={(e) => set('lga', e.target.value)} />
        <input placeholder="Nationality" value={value.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} />
        <input placeholder="Phone" value={value.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        <input type="email" placeholder="Email" value={value.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        {withRelationship && (
          <input
            placeholder="Relationship with child"
            value={value.relationship ?? ''}
            onChange={(e) => set('relationship', e.target.value)}
          />
        )}
      </div>
    </fieldset>
  );
}

function RegistrationModal({
  admissionId,
  registerOnSave,
  onClose,
  onDone,
}: {
  admissionId: string;
  registerOnSave: boolean;
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const [reg, setReg] = useState<RegistrationDetails | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [status, setStatus] = useState<AdmissionStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    admissionsApi
      .get(admissionId)
      .then((a) => {
        setApplicantName(a.applicantName);
        setStatus(a.status);
        setReg({
          father: emptyGuardian,
          mother: emptyGuardian,
          guardian: emptyGuardian,
          ...(a.registration ?? {}),
        });
      })
      .catch((e) => setErr(e.message));
  }, [admissionId]);

  const set = (k: keyof RegistrationDetails, v: unknown) => setReg((r) => (r ? { ...r, [k]: v } : r));

  async function handleFile(k: 'passportPhoto' | 'birthCertificate', file: File | undefined) {
    if (!file) return;
    setErr(null);
    if (file.size > MAX_DOC_BYTES) {
      setErr(`${k === 'passportPhoto' ? 'Passport photo' : 'Birth certificate'} must be under 1.5 MB`);
      return;
    }
    const okType =
      k === 'passportPhoto' ? file.type.startsWith('image/') : file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) {
      setErr(k === 'passportPhoto' ? 'Passport photo must be an image' : 'Birth certificate must be an image or PDF');
      return;
    }
    set(k, await fileToDataUri(file));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reg) return;
    setSaving(true);
    setErr(null);
    try {
      const saved = await admissionsApi.submitRegistration(admissionId, reg);
      if (registerOnSave) {
        const registered = await admissionsApi.transition(admissionId, 'Registered');
        onDone(`Registered — registration number ${registered.registration?.registrationNumber ?? ''}`);
      } else {
        onDone(
          saved.registration?.registrationNumber
            ? `Registration form saved (Reg. No. ${saved.registration.registrationNumber})`
            : 'Registration form saved'
        );
      }
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to save registration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-3xl my-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-display font-semibold">Registration form</h2>
            <p className="info-card-sub">
              {applicantName || '…'}
              {status && <span className={`status-badge status-${status.replace(/\s+/g, '')} ml-2`}>{status}</span>}
            </p>
          </div>
          {reg?.registrationNumber && (
            <span className="status-badge status-Registered">Reg. No. {reg.registrationNumber}</span>
          )}
        </div>

        {!reg ? (
          <p className="info-card-empty">{err ?? 'Loading…'}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Date of birth
                <input type="date" value={reg.dob ? reg.dob.slice(0, 10) : ''} onChange={(e) => set('dob', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Gender
                <select value={reg.gender ?? ''} onChange={(e) => set('gender', e.target.value || undefined)}>
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Place of birth
                <input value={reg.placeOfBirth ?? ''} onChange={(e) => set('placeOfBirth', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Nationality
                <input value={reg.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Health issues (if any)
                <input value={reg.healthIssues ?? ''} onChange={(e) => set('healthIssues', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                Residential address
                <input value={reg.residentialAddress ?? ''} onChange={(e) => set('residentialAddress', e.target.value)} />
              </label>
            </div>

            <GuardianFields label="Father" value={reg.father ?? emptyGuardian} onChange={(v) => set('father', v)} />
            <GuardianFields label="Mother" value={reg.mother ?? emptyGuardian} onChange={(v) => set('mother', v)} />
            <GuardianFields
              label="Guardian"
              value={reg.guardian ?? emptyGuardian}
              onChange={(v) => set('guardian', v)}
              withRelationship
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Passport photograph</span>
                <input type="file" accept="image/*" onChange={(e) => handleFile('passportPhoto', e.target.files?.[0])} />
                {reg.passportPhoto && (
                  <img
                    src={reg.passportPhoto}
                    alt="passport preview"
                    className="h-24 w-24 object-cover rounded-xl2 border border-stone-200"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Birth certificate</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFile('birthCertificate', e.target.files?.[0])}
                />
                {reg.birthCertificate && (
                  <span className="text-xs text-brand-700">
                    {reg.birthCertificate.startsWith('data:application/pdf') ? 'PDF attached' : 'Image attached'}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {err && <p className="error">{err}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !reg}>
            {saving ? 'Saving…' : registerOnSave ? 'Save & register applicant' : 'Save registration'}
          </button>
          <button type="button" className="!bg-stone-100 !text-ink hover:!bg-stone-200" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdmissionsPage() {
  const [list, setList] = useState<Admission[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [applicantName, setApplicantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [regTarget, setRegTarget] = useState<{ id: string; registerOnSave: boolean } | null>(null);
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
    setNotice(null);
    if (newStatus === 'Active') {
      setActiveTarget({ id: admission._id, classId: '', dob: '', feeAmount: '' });
      return;
    }
    if (newStatus === 'Registered') {
      // The registration form IS the registration step — open it.
      setRegTarget({ id: admission._id, registerOnSave: true });
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
        dob: activeTarget.dob || undefined,
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
      {notice && <p className="text-sm text-brand-700 font-medium mb-2">{notice}</p>}

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
          <span>Enrolling — class and fee (DOB comes from the registration form):</span>
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
            title="Optional — only needed if no registration form is on file"
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

      {regTarget && (
        <RegistrationModal
          admissionId={regTarget.id}
          registerOnSave={regTarget.registerOnSave}
          onClose={() => setRegTarget(null)}
          onDone={(message) => {
            if (message) setNotice(message);
            refresh();
          }}
        />
      )}

      <div className="table-scroll">
        <table className="data-table fit-columns">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Reg. no.</th>
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
                  {a.registration?.registrationNumber ? (
                    <span className="text-xs font-mono text-ink">{a.registration.registrationNumber}</span>
                  ) : (
                    <span className="info-card-empty">—</span>
                  )}
                </td>
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
                    <button
                      type="button"
                      className="!bg-brand-50 !text-brand-700 hover:!bg-brand-100"
                      onClick={() => setRegTarget({ id: a._id, registerOnSave: false })}
                    >
                      {a.registration?.submittedAt ? 'View / edit form' : 'Registration form'}
                    </button>
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
