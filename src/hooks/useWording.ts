import { School, SchoolWording } from '../api/types';
import { useSchool } from './useSchool';

// The words this school uses (Settings → School profile), e.g. "Pupil"
// instead of "Student". Falls back to the app's original wording.
export const DEFAULT_WORDING: SchoolWording = { pupil: 'Student', headTeacher: 'Head Teacher', classTeacher: 'Form Teacher' };

export function wordingOf(school: School | null | undefined): SchoolWording {
  return { ...DEFAULT_WORDING, ...(school?.wording ?? {}) };
}

export function useWording(): SchoolWording & { pupils: string } {
  const { school } = useSchool();
  const w = wordingOf(school);
  return { ...w, pupils: `${w.pupil}s` };
}
