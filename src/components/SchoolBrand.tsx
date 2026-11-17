import { useEffect } from 'react';
import { useSchool } from '../hooks/useSchool';
import { useWording } from '../hooks/useWording';
import { applyBrandColor } from '../utils/theme';

// Only rendered for school users (a super admin has no school).

/** The school's logo and name where the app used to say "SMIS". */
export function BrandMark({ className }: { className: string }) {
  const { school } = useSchool();
  if (!school) return <span className={className}>SMIS</span>;
  return (
    <span className={`${className} brand-school`} title={school.name}>
      {school.logo && <img src={school.logo} alt="" className="brand-logo" />}
      <span className="brand-name">{school.name}</span>
    </span>
  );
}

/** Applies the school's colour and puts its name in the browser tab. */
export function SchoolTheme() {
  const { school } = useSchool();
  useEffect(() => {
    applyBrandColor(school?.brandColor);
    if (school?.name) document.title = school.name;
    return () => {
      applyBrandColor(null);
      document.title = 'SMIS';
    };
  }, [school?.brandColor, school?.name]);
  return null;
}

/** "Students" or "Pupils", as the school prefers. */
export function PupilsLabel() {
  return <>{useWording().pupils}</>;
}
