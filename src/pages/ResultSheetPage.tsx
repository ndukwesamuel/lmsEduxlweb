import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { reportCards as reportCardsApi } from '../api/resources';
import { FullResultCard, GradeBand } from '../api/types';
import { useSchool } from '../hooks/useSchool';
import { useWording } from '../hooks/useWording';
import { SchoolTheme } from '../components/SchoolBrand';

// A clean, printable result sheet — the browser's Print dialog prints it or
// saves it as a PDF. Rendered outside the app layout so no menus print.

function bandFor(score: number, scale: GradeBand[]): GradeBand | undefined {
  return [...scale].sort((a, b) => b.minScore - a.minScore).find((b) => score >= b.minScore);
}

export default function ResultSheetPage() {
  const { studentId } = useParams();
  const [params] = useSearchParams();
  const term = params.get('term') ?? '';
  const navigate = useNavigate();
  const { school } = useSchool();
  const words = useWording();
  const [card, setCard] = useState<FullResultCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !term) return;
    reportCardsApi
      .get(studentId, term)
      .then(setCard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the result'));
  }, [studentId, term]);

  const scale = school?.gradingScale ?? [];
  const average = card?.average ?? null;
  const overall = average !== null ? bandFor(average, scale) : undefined;
  const canPrint = card && card.subjects.length > 0 && (card.released || card.withheld === false);

  useEffect(() => {
    if (card) document.title = `Result — ${card.student.name} — ${card.term}`;
    return () => {
      document.title = 'SMIS';
    };
  }, [card]);

  return (
    <div className="result-sheet-page">
      <SchoolTheme />
      <div className="no-print flex flex-wrap gap-2 justify-between items-center mb-4">
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
        {canPrint && (
          <div className="flex flex-col items-end">
            <button type="button" onClick={() => window.print()}>
              🖨 Print / Save as PDF
            </button>
            <span className="text-xs text-ink-soft mt-1">To download, choose "Save as PDF" in the print window.</span>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {!card && !error && <p className="info-card-empty">Loading…</p>}

      {card && !canPrint && (
        <div className="announcement-banner">
          <span className="announcement-banner-title">{card.withheld ? 'Result withheld' : 'Result not available yet'}</span>
          <span className="announcement-banner-message">
            {card.withheld
              ? "This term's result has not been released to you yet. Please contact the school."
              : 'There is no released result for this term yet.'}
          </span>
        </div>
      )}

      {card && canPrint && (
        <article className="result-sheet">
          <header className="result-sheet-header">
            {school?.logo && <img src={school.logo} alt="" className="result-sheet-logo" />}
            <div>
              <h1>{school?.name ?? ''}</h1>
              {school?.motto && <p className="result-sheet-motto">“{school.motto}”</p>}
              {(school?.address || school?.phone) && (
                <p className="result-sheet-contact">{[school.address, school.phone].filter(Boolean).join(' · ')}</p>
              )}
              <p className="result-sheet-title">{words.pupil}'s Result Sheet</p>
            </div>
          </header>

          <table className="result-sheet-info">
            <tbody>
              <tr>
                <th>Name</th>
                <td>{card.student.name}</td>
                <th>Class</th>
                <td>{card.student.className ?? '—'}</td>
              </tr>
              <tr>
                <th>Term</th>
                <td>{card.term}</td>
                <th>Attendance</th>
                <td>
                  {card.attendance.totalDays > 0
                    ? `${card.attendance.daysPresent} of ${card.attendance.totalDays} days (${card.attendance.attendanceRate?.toFixed(0)}%)`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="result-sheet-grades">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Subject</th>
                <th>CA (40)</th>
                <th>Exam (60)</th>
                <th>Total (100)</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {card.subjects.map((s, i) => (
                <tr key={s.subject}>
                  <td>{i + 1}</td>
                  <td className="text-left">{s.subject}</td>
                  <td>{s.caScore}</td>
                  <td>{s.examScore}</td>
                  <td>
                    <strong>{s.total}</strong>
                  </td>
                  <td>
                    <strong>{s.letterGrade}</strong>
                  </td>
                  <td className="text-left">{s.remark ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="result-sheet-info">
            <tbody>
              <tr>
                <th>Total score</th>
                <td>
                  {card.totalScore ?? '—'} out of {card.subjects.length * 100}
                </td>
                <th>Average</th>
                <td>
                  {average ?? '—'}
                  {overall && ` (${overall.grade}${overall.remark ? ` — ${overall.remark}` : ''})`}
                </td>
              </tr>
              <tr>
                <th>Conduct</th>
                <td colSpan={3}>{card.conductRating ?? '—'}</td>
              </tr>
              <tr>
                <th>{words.classTeacher}'s comment</th>
                <td colSpan={3}>{card.teacherComment || '—'}</td>
              </tr>
              <tr>
                <th>{words.headTeacher}'s remark</th>
                <td colSpan={3}>{card.adminRemark || '—'}</td>
              </tr>
            </tbody>
          </table>

          {scale.length > 0 && (
            <p className="result-sheet-key">
              <strong>Grading key:</strong>{' '}
              {[...scale]
                .sort((a, b) => b.minScore - a.minScore)
                .map((b, i, all) => {
                  const top = i === 0 ? 100 : all[i - 1].minScore - 1;
                  return `${b.grade} (${b.minScore}–${top}${b.remark ? ` ${b.remark}` : ''})`;
                })
                .join(' · ')}
            </p>
          )}

          <div className="result-sheet-signatures">
            <div className="result-sheet-sign">
              <div className="result-sheet-sign-space" />
              <div className="result-sheet-sign-line">{words.classTeacher}'s signature</div>
            </div>
            <div className="result-sheet-sign">
              <div className="result-sheet-sign-space">
                {school?.signature && <img src={school.signature} alt="" className="result-sheet-signature" />}
                {school?.stamp && <img src={school.stamp} alt="" className="result-sheet-stamp" />}
              </div>
              <div className="result-sheet-sign-line">
                {school?.headTeacherName ? `${school.headTeacherName}, ` : ''}
                {words.headTeacher}
              </div>
            </div>
          </div>

          <p className="result-sheet-footer">Printed on {new Date().toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
        </article>
      )}
    </div>
  );
}
