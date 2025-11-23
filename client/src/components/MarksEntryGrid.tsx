import { useState, useEffect } from 'react';
import { PenTool, Save } from 'lucide-react';

// ==========================================
// 1. MARKS ENTRY GRID (The New Feature)
// ==========================================
const MarksEntryGrid = ({ user }) => {
  const [context, setContext] = useState({
    district_id: user.district_id || '',
    mandal_id: user.mandal_id || '',
    school_id: user.school_id || '',
    class_id: '', exam_id: '', subject_id: ''
  });

  const [lists, setLists] = useState({ districts: [], mandals: [], schools: [], classes: [], exams: [], subjects: [] });
  const [studentsGrid, setStudentsGrid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  // --- CASCADING DROPDOWN FETCHES ---
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setLists(p => ({ ...p, districts: Array.isArray(data) ? data : [] })));
  }, []);

  useEffect(() => {
    if (context.district_id) {
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals?district_id=${context.district_id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(data => setLists(p => ({ ...p, mandals: Array.isArray(data) ? data : [] })));
    }
  }, [context.district_id]);

  useEffect(() => {
    if (context.mandal_id) {
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/schools?mandal_id=${context.mandal_id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(data => setLists(p => ({ ...p, schools: Array.isArray(data) ? data : [] })));
    }
  }, [context.mandal_id]);

  useEffect(() => {
    if (context.school_id) {
      const h = { 'Authorization': `Bearer ${token}` };
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/classes?school_id=${context.school_id}`, { headers: h }).then(res => res.json()).then(data => setLists(p => ({ ...p, classes: Array.isArray(data) ? data : [] })));
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/exams`, { headers: h }).then(res => res.json()).then(data => setLists(p => ({ ...p, exams: Array.isArray(data) ? data : [] })));
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/subjects`, { headers: h }).then(res => res.json()).then(data => setLists(p => ({ ...p, subjects: Array.isArray(data) ? data : [] })));
    }
  }, [context.school_id]);

  // --- GRID LOGIC ---
  const loadGrid = async () => {
    if (!context.class_id || !context.exam_id || !context.subject_id) { setMsg("Please select Class, Exam, and Subject."); return; }
    setLoading(true); setMsg('');

    try {
      // 1. Fetch Students
      const studRes = await fetch(`${import.meta.env.VITE_API_URL}/api/entities/students?class_id=${context.class_id}&school_id=${context.school_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const students = await studRes.json();

      // 2. Fetch Existing Marks
      const marksRes = await fetch(`${import.meta.env.VITE_API_URL}/api/marks/fetch?exam_id=${context.exam_id}&subject_id=${context.subject_id}&class_id=${context.class_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const existingMarks = await marksRes.json();

      // 3. Merge
      const merged = Array.isArray(students) ? students.map(stud => {
        const found = existingMarks.find(m => m.student_id === stud.id);
        return {
          student_id: stud.id, name: stud.name, pen: stud.pen_number,
          marks_obtained: found ? found.marks_obtained : '', // Pre-fill existing
          max_marks: found ? found.max_marks : 100
        };
      }) : [];

      setStudentsGrid(merged);
      if (merged.length === 0) setMsg("No students found in this class.");
    } catch (err) { setMsg("Error loading data."); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        const payload = {
            exam_id: context.exam_id, subject_id: context.subject_id,
            marks_data: studentsGrid.filter(row => row.marks_obtained !== '').map(row => ({ student_id: row.student_id, marks: row.marks_obtained, max_marks: row.max_marks }))
        };
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/marks/bulk-update`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        if (res.ok) setMsg("Marks Saved Successfully!"); else setMsg("Failed to save.");
    } catch (e) { setMsg("Network Error"); } finally { setLoading(false); }
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || !context.district_id;
  const isSchoolLocked = user.role === 'school_admin' || !context.mandal_id;

  return (
    <div className="bg-white p-6 rounded shadow border border-gray-200">
       <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><PenTool className="h-6 w-6 text-blue-600"/> Marks Entry</h2>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded border border-gray-100">
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">District</label>
           <select className={`w-full p-2 border rounded text-sm ${isDistrictLocked ? 'bg-gray-100' : 'bg-white'}`} value={context.district_id} onChange={e => setContext({...context, district_id: e.target.value, mandal_id: '', school_id: ''})} disabled={isDistrictLocked}>
             <option value="">Select District</option>{lists.districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
           </select></div>
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mandal</label>
           <select className={`w-full p-2 border rounded text-sm ${isMandalLocked ? 'bg-gray-100' : 'bg-white'}`} value={context.mandal_id} onChange={e => setContext({...context, mandal_id: e.target.value, school_id: ''})} disabled={isMandalLocked}>
             <option value="">Select Mandal</option>{lists.mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
           </select></div>
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">School</label>
           <select className={`w-full p-2 border rounded text-sm ${isSchoolLocked ? 'bg-gray-100' : 'bg-white'}`} value={context.school_id} onChange={e => setContext({...context, school_id: e.target.value})} disabled={isSchoolLocked}>
             <option value="">Select School</option>{lists.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
           </select></div>
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class</label>
           <select className="w-full p-2 border rounded text-sm" value={context.class_id} onChange={e => setContext({...context, class_id: e.target.value})} disabled={!context.school_id}>
             <option value="">Select Class</option>{lists.classes.map(c => <option key={c.id} value={c.id}>{c.grade_level}</option>)}
           </select></div>
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Exam</label>
           <select className="w-full p-2 border rounded text-sm" value={context.exam_id} onChange={e => setContext({...context, exam_id: e.target.value})} disabled={!context.school_id}>
             <option value="">Select Exam</option>{lists.exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
           </select></div>
         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
           <select className="w-full p-2 border rounded text-sm" value={context.subject_id} onChange={e => setContext({...context, subject_id: e.target.value})} disabled={!context.school_id}>
             <option value="">Select Subject</option>{lists.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
           </select></div>
       </div>
       <div className="flex justify-end mb-6">
         <button onClick={loadGrid} disabled={!context.class_id || !context.exam_id || !context.subject_id} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
           {loading ? 'Loading...' : 'Fetch Student List'}
         </button>
       </div>
       {msg && <div className={`p-3 mb-4 text-center rounded font-medium ${msg.includes('Success') ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>{msg}</div>}
       {studentsGrid.length > 0 && (
         <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-gray-700">Enter Marks</h3><button onClick={handleSave} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"><Save className="h-4 w-4" /> Save All</button></div>
            <div className="overflow-hidden border rounded-lg">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 uppercase text-xs font-bold text-gray-600 border-b"><tr><th className="px-6 py-3 w-32">PEN No.</th><th className="px-6 py-3">Student Name</th><th className="px-6 py-3 w-40 text-center">Marks (Max 100)</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                     {studentsGrid.map((row, idx) => (
                       <tr key={row.student_id} className="hover:bg-blue-50 transition-colors">
                          <td className="px-6 py-3 font-mono text-gray-500">{row.pen}</td>
                          <td className="px-6 py-3 font-medium text-gray-900">{row.name}</td>
                          <td className="px-6 py-3 text-center"><input type="number" min="0" max="100" className="w-20 p-2 border border-gray-300 rounded text-center font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" value={Number(row.marks_obtained)} onChange={(e) => setStudentsGrid(prev => prev.map(r => r.student_id === row.student_id ? { ...r, marks_obtained: e.target.value } : r))} placeholder="-" tabIndex={idx + 1} /></td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
       )}
    </div>
  );
};

export default MarksEntryGrid;