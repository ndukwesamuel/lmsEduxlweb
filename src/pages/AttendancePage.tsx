import { useEffect, useState } from 'react';
import { attendance as attendanceApi, classes as classesApi, students as studentsApi } from '../api/resources';
import { AttendanceLog, SchoolClass, Student } from '../api/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [roster, setRoster] = useState<Student[]>([]);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<AttendanceLog[]>([]);
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

  useEffect(() => {
    if (!selectedClassId) return;
    setSaved(false);
    studentsApi
      .list()
      .then((all) => {
        const classStudents = all.filter((s) => s.classId === selectedClassId);
        setRoster(classStudents);
        setPresentMap(Object.fromEntries(classStudents.map((s) => [s._id, true])));
      })
      .catch((err) => setError(err.message));
    attendanceApi
      .history(selectedClassId, date)
      .then(setHistory)
      .catch((err) => setError(err.message));
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
  }, [history]);

  async function handleSubmit() {
    setError(null);
    setSaved(false);
    try {
      const entries = roster.map((s) => ({ studentId: s._id, present: presentMap[s._id] ?? true }));
      await attendanceApi.mark(selectedClassId, date, entries);
      setSaved(true);
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
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-brand-600"
                        checked={presentMap[s._id] ?? true}
                        onChange={(e) => setPresentMap({ ...presentMap, [s._id]: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mt-4" onClick={handleSubmit}>
            Save attendance for whole class
          </button>
        </>
      )}
    </div>
  );
}
