import { useEffect, useState } from 'react';
import { attendance as attendanceApi, classes as classesApi, students as studentsApi } from '../api/resources';
import { AttendanceLog, AttendanceSummaryRow, SchoolClass, Student } from '../api/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [roster, setRoster] = useState<Student[]>([]);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        if (cs.length > 0) setSelectedClassId(cs[0]._id);
      })
      .catch((err) => setError(err.message));
  }, []);

  function refreshSummary() {
    if (!selectedClassId) return;
    attendanceApi.summary(selectedClassId).then(setSummary).catch(() => {});
  }

  useEffect(() => {
    if (!selectedClassId) return;
    setSaved(false);
    studentsApi
      .list()
      .then((all) => {
        const classStudents = all.filter((s) => s.classId === selectedClassId);
        setRoster(classStudents);
        setPresentMap(Object.fromEntries(classStudents.map((s) => [s._id, true])));
        setCommentMap({});
      })
      .catch((err) => setError(err.message));
    attendanceApi
      .history(selectedClassId, date)
      .then(setHistory)
      .catch((err) => setError(err.message));
    refreshSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, date]);

  useEffect(() => {
    if (history.length === 0) return;
    setPresentMap((prev) => {
      const next = { ...prev };
      history.forEach((log) => {
        next[log.studentId] = log.present;
      });
      return next;
    });
    setCommentMap((prev) => {
      const next = { ...prev };
      history.forEach((log) => {
        if (log.comment) next[log.studentId] = log.comment;
      });
      return next;
    });
  }, [history]);

  function togglePresent(studentId: string, present: boolean) {
    setPresentMap({ ...presentMap, [studentId]: present });
    if (present) {
      setCommentMap((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  }

  async function handleSubmit() {
    setError(null);
    setSaved(false);
    try {
      const entries = roster.map((s) => ({
        studentId: s._id,
        present: presentMap[s._id] ?? true,
        comment: presentMap[s._id] === false ? commentMap[s._id] : undefined,
      }));
      await attendanceApi.mark(selectedClassId, date, entries);
      setSaved(true);
      refreshSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    }
  }

  return (
    <div>
      <h1>Mark Attendance</h1>

      <div className="inline-form">
        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
          {classList.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      {saved && <p className="success">Attendance saved.</p>}

      {roster.length === 0 ? (
        <p>No students in this class, or you don't have access to mark attendance for it.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Present</th>
                  <th>Reason for absence</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const isPresent = presentMap[s._id] ?? true;
                  return (
                    <tr key={s._id}>
                      <td>{s.name}</td>
                      <td>
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-brand-600"
                          checked={isPresent}
                          onChange={(e) => togglePresent(s._id, e.target.checked)}
                        />
                      </td>
                      <td>
                        {!isPresent && (
                          <input
                            value={commentMap[s._id] ?? ''}
                            onChange={(e) => setCommentMap({ ...commentMap, [s._id]: e.target.value })}
                            placeholder="e.g. Sick with flu"
                            className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm w-full max-w-xs focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-500"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="mt-4" onClick={handleSubmit}>
            Save attendance for whole class
          </button>

          {summary.length > 0 && (
            <div className="mt-8">
              <h2>Attendance rate this class</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Days present</th>
                      <th>Total days</th>
                      <th>Attendance rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.studentId}>
                        <td>{row.name}</td>
                        <td>{row.daysPresent}</td>
                        <td>{row.totalDays}</td>
                        <td>{row.attendanceRate === null ? '—' : `${row.attendanceRate.toFixed(0)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
