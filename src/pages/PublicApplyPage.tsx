import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApply } from '../api/resources';
import { ApiError } from '../api/client';
import { GuardianDetails } from '../api/types';

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
}: {
  label: string;
  value: GuardianDetails;
  onChange: (next: GuardianDetails) => void;
}) {
  const set = (k: keyof GuardianDetails, v: string) => onChange({ ...value, [k]: v });
  return (
    <fieldset className="border border-stone-200 rounded-xl2 p-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft px-1">{label}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input placeholder="Name" value={value.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        <input placeholder="Phone" value={value.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        <input type="email" placeholder="Email" value={value.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        <input placeholder="Profession" value={value.profession ?? ''} onChange={(e) => set('profession', e.target.value)} />
      </div>
    </fieldset>
  );
}

interface FormState {
  applicantName: string;
  guardianPhone: string;
  guardianEmail: string;
  dob: string;
  gender: '' | 'Male' | 'Female';
  placeOfBirth: string;
  residentialAddress: string;
  father: GuardianDetails;
  mother: GuardianDetails;
  guardian: GuardianDetails;
  passportPhoto?: string;
  birthCertificate?: string;
  website: string; // honeypot — left blank by real visitors
}

const initialForm: FormState = {
  applicantName: '',
  guardianPhone: '',
  guardianEmail: '',
  dob: '',
  gender: '',
  placeOfBirth: '',
  residentialAddress: '',
  father: emptyGuardian,
  mother: emptyGuardian,
  guardian: emptyGuardian,
  website: '',
};

export default function PublicApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    publicApply
      .getSchool(slug)
      .then((s) => setSchoolName(s.name))
      .catch(() => setNotFound(true));
  }, [slug]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleFile(k: 'passportPhoto' | 'birthCertificate', file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_DOC_BYTES) {
      setError(`${k === 'passportPhoto' ? 'Passport photo' : 'Birth certificate'} must be under 1.5 MB`);
      return;
    }
    const okType =
      k === 'passportPhoto' ? file.type.startsWith('image/') : file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) {
      setError(k === 'passportPhoto' ? 'Passport photo must be an image' : 'Birth certificate must be an image or PDF');
      return;
    }
    set(k, await fileToDataUri(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await publicApply.submit(slug, {
        applicantName: form.applicantName,
        guardianName: form.father.name || form.mother.name || form.guardian.name,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        placeOfBirth: form.placeOfBirth || undefined,
        residentialAddress: form.residentialAddress || undefined,
        father: form.father,
        mother: form.mother,
        guardian: form.guardian,
        passportPhoto: form.passportPhoto,
        birthCertificate: form.birthCertificate,
        website: form.website,
      });
      setSubmitted(res.applicantName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="auth-page">
        <div className="auth-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="auth-card">
            <h1>Link not found</h1>
            <p className="auth-subtitle">This application link isn't valid. Please check the link the school gave you.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="auth-brand-mark">SMIS</span>
        <h2>{schoolName ?? 'Loading…'}</h2>
        <p>Admission application — tell us about your child and we'll be in touch.</p>
      </div>
      <div className="auth-panel">
        {submitted ? (
          <div className="auth-card">
            <h1>Application received</h1>
            <p className="auth-subtitle">
              Thank you — {submitted}'s application has been submitted. The school will review it and contact you with
              next steps.
            </p>
          </div>
        ) : (
          <form className="auth-card" style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
            <h1>Apply for admission</h1>
            <p className="auth-subtitle">Fill in as much as you can — you can also bring documents in person later.</p>

            <label>
              Child's full name
              <input value={form.applicantName} onChange={(e) => set('applicantName', e.target.value)} required />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 mt-2">
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Date of birth
                <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Gender
                <select value={form.gender} onChange={(e) => set('gender', e.target.value as FormState['gender'])}>
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1">
                Place of birth
                <input value={form.placeOfBirth} onChange={(e) => set('placeOfBirth', e.target.value)} />
              </label>
              <label className="text-xs text-ink-soft flex flex-col gap-1 sm:col-span-2">
                Residential address
                <input value={form.residentialAddress} onChange={(e) => set('residentialAddress', e.target.value)} />
              </label>
            </div>

            <div className="flex flex-col gap-3 mt-3">
              <GuardianFields label="Father" value={form.father} onChange={(v) => set('father', v)} />
              <GuardianFields label="Mother" value={form.mother} onChange={(v) => set('mother', v)} />
              <GuardianFields label="Guardian (if applicable)" value={form.guardian} onChange={(v) => set('guardian', v)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Passport photograph (optional now)
                </span>
                <input type="file" accept="image/*" onChange={(e) => handleFile('passportPhoto', e.target.files?.[0])} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Birth certificate (optional now)
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFile('birthCertificate', e.target.files?.[0])}
                />
              </div>
            </div>

            {/* Honeypot — hidden from real visitors, bots that fill every field trip it. */}
            <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </label>
            </div>

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={submitting} style={{ marginTop: '1rem' }}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
