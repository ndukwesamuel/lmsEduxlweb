import { FormEvent, useEffect, useState } from 'react';
import { school as schoolApi } from '../api/resources';
import { School, SchoolWording } from '../api/types';
import { setSchoolCache } from '../hooks/useSchool';
import { wordingOf } from '../hooks/useWording';
import { applyBrandColor } from '../utils/theme';
import PhotoField, { BRANDING_LIMITS } from './PhotoField';

// Colours that keep white button text readable.
const PRESET_COLOURS = [
  { name: 'Teal (default)', hex: '#0d9488' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Royal blue', hex: '#1d4ed8' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Purple', hex: '#6d28d9' },
  { name: 'Maroon', hex: '#7f1d1d' },
  { name: 'Wine', hex: '#9f1239' },
  { name: 'Brown', hex: '#92400e' },
];

const WORDING_OPTIONS: { key: keyof SchoolWording; label: string; choices: string[] }[] = [
  { key: 'pupil', label: 'Children are called', choices: ['Student', 'Pupil'] },
  { key: 'headTeacher', label: 'The head of school is the', choices: ['Head Teacher', 'Principal', 'Proprietor', 'Proprietress'] },
  { key: 'classTeacher', label: 'A class’s own teacher is the', choices: ['Form Teacher', 'Class Teacher'] },
];

type Profile = {
  name: string;
  address: string;
  phone: string;
  motto: string;
  headTeacherName: string;
  logo: string;
  signature: string;
  stamp: string;
  brandColor: string;
  wording: SchoolWording;
};

function profileOf(school: School): Profile {
  return {
    name: school.name ?? '',
    address: school.address ?? '',
    phone: school.phone ?? '',
    motto: school.motto ?? '',
    headTeacherName: school.headTeacherName ?? '',
    logo: school.logo ?? '',
    signature: school.signature ?? '',
    stamp: school.stamp ?? '',
    brandColor: school.brandColor ?? '',
    wording: wordingOf(school),
  };
}

export default function SchoolProfileCard({ school }: { school: School }) {
  const [p, setP] = useState<Profile>(() => profileOf(school));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setP(profileOf(school)), [school]);

  // Preview the colour live; put the saved one back when leaving the page.
  useEffect(() => {
    applyBrandColor(p.brandColor || null);
  }, [p.brandColor]);
  useEffect(() => () => applyBrandColor(school.brandColor), [school.brandColor]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setMessage(null);
    setP((prev) => ({ ...prev, [k]: v }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await schoolApi.update({
        name: p.name,
        address: p.address,
        phone: p.phone,
        motto: p.motto,
        headTeacherName: p.headTeacherName,
        logo: p.logo || null,
        signature: p.signature || null,
        stamp: p.stamp || null,
        brandColor: p.brandColor || null,
        wording: p.wording,
      });
      setSchoolCache(updated);
      setMessage('School profile saved. Everyone sees it the next time their page loads.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the school profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card mb-6" onSubmit={save}>
      <h2>School profile</h2>
      <p className="info-card-sub mb-4">
        Your school's name, logo, colour and wording. They appear in the menu, on the parents' application page and on
        printed result sheets.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <label className="filter-field">
          <span>School name</span>
          <input className="sheet-input" value={p.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required />
        </label>
        <label className="filter-field">
          <span>Motto</span>
          <input className="sheet-input" value={p.motto} onChange={(e) => set('motto', e.target.value)} maxLength={120} placeholder="e.g. Knowledge and Character" />
        </label>
        <label className="filter-field">
          <span>Address</span>
          <input className="sheet-input" value={p.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
        </label>
        <label className="filter-field">
          <span>Phone</span>
          <input className="sheet-input" value={p.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
        </label>
        <label className="filter-field">
          <span>{p.wording.headTeacher}'s name (for result sheets)</span>
          <input className="sheet-input" value={p.headTeacherName} onChange={(e) => set('headTeacherName', e.target.value)} maxLength={80} placeholder="e.g. Mrs A. Okoro" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <PhotoField
          label="School logo"
          value={p.logo || undefined}
          onChange={(uri) => set('logo', uri)}
          onClear={() => set('logo', '')}
          onError={setError}
          limits={BRANDING_LIMITS}
        />
        <PhotoField
          label={`${p.wording.headTeacher}'s signature`}
          value={p.signature || undefined}
          onChange={(uri) => set('signature', uri)}
          onClear={() => set('signature', '')}
          onError={setError}
          limits={BRANDING_LIMITS}
        />
        <PhotoField
          label="School stamp"
          value={p.stamp || undefined}
          onChange={(uri) => set('stamp', uri)}
          onClear={() => set('stamp', '')}
          onError={setError}
          limits={BRANDING_LIMITS}
        />
      </div>
      <p className="info-card-sub mb-5">
        Tip: for the signature and stamp, sign or stamp a clean white sheet of paper and take a photo of it close up.
      </p>

      <div className="mb-5">
        <span className="filter-field mb-2">
          <span>School colour</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLOURS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              onClick={() => set('brandColor', c.hex === '#0d9488' ? '' : c.hex)}
              className={`colour-swatch ${(p.brandColor || '#0d9488') === c.hex ? 'colour-swatch-active' : ''}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <label className="flex items-center gap-2 text-sm text-ink-soft ml-1">
            or pick any:
            <input
              type="color"
              value={p.brandColor || '#0d9488'}
              onChange={(e) => set('brandColor', e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-stone-200 bg-white p-0.5"
            />
          </label>
        </div>
        <p className="info-card-sub mt-2">You're seeing a preview now. Very light colours are darkened so button text stays readable.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {WORDING_OPTIONS.map((o) => (
          <label key={o.key} className="filter-field">
            <span>{o.label}</span>
            <select
              className="sheet-input"
              value={p.wording[o.key]}
              onChange={(e) => set('wording', { ...p.wording, [o.key]: e.target.value } as SchoolWording)}
            >
              {o.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save school profile'}
      </button>
    </form>
  );
}
