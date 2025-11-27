import { useState, useEffect } from 'react';
import { PenTool, Save } from 'lucide-react';

// ==========================================
// 1. MARKS ENTRY GRID (Updated: Global Classes)
// ==========================================
const MarksEntryGrid = ({ user }) => {
  const [context, setContext] = useState({ 
    district_id: user.district_id || '', 
    mandal_id: user.mandal_id || '', 
    school_id: user.school_id || '', 
    class_id: '', 
    exam_id: '', 
    subject_id: '' 
  });

  const [lists, setLists] = useState({ districts: [], mandals: [], schools: [], classes: [], exams: [], subjects: [] });
  const [studentsGrid, setStudentsGrid] = useState([]);
  const [activeSubjects, setActiveSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  // HIGHLIGHT: Fetch Classes Globally on Mount (Decoupled from School)
  useEffect(() => { 
    const h = { 'Authorization': `Bearer ${token}` };
    
    // 1. Geography (Admin only usually, but safe to fetch)
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, { headers: h }).then(r=>r.json()).then(d=>setLists(p=>({...p, districts: Array.isArray(d)?d:[]}))); 
    
    // 2. Global Entities (Classes, Exams, Subjects) - Fetched ONCE
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/classes`, {headers:h}).then(r=>r.json()).then(d=>setLists(p=>({...p, classes:Array.isArray(d)?d:[]})));
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/exams`, {headers:h}).then(r=>r.json()).then(d=>setLists(p=>({...p, exams:Array.isArray(d)?d:[]})));
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/subjects`, {headers:h}).then(r=>r.json()).then(d=>setLists(p=>({...p, subjects:Array.isArray(d)?d:[]})));
  }, []);

  // Hierarchical Fetches (Only for filtering Schools)
  useEffect(() => { if(context.district_id) fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals?district_id=${context.district_id}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r=>r.json()).then(d=>setLists(p=>({...p, mandals: Array.isArray(d)?d:[]}))); }, [context.district_id]);
  useEffect(() => { if(context.mandal_id) fetch(`${import.meta.env.VITE_API_URL}/api/entities/schools?mandal_id=${context.mandal_id}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r=>r.json()).then(d=>setLists(p=>({...p, schools: Array.isArray(d)?d:[]}))); }, [context.mandal_id]);

  const loadGrid = async () => {
    if(!context.school_id || !context.class_id || !context.exam_id) return setMsg("Select School, Class, and Exam");
    setLoading(true); setMsg('');
    try {
      let cols = [];
      if (context.subject_id === 'all' || !context.subject_id) cols = lists.subjects; 
      else { const sub = lists.subjects.find(s => s.id === context.subject_id); if (sub) cols = [sub]; }
      setActiveSubjects(cols);

      // Fetch Students: Filters by School AND Global Class ID
      const studRes = await fetch(`${import.meta.env.VITE_API_URL}/api/entities/students?school_id=${context.school_id}&class_id=${context.class_id}`, {headers:{'Authorization':`Bearer ${token}`}});
      const students = await studRes.json();

      const queryParams = `exam_id=${context.exam_id}&class_id=${context.class_id}` + (context.subject_id && context.subject_id !== 'all' ? `&subject_id=${context.subject_id}` : '');
      const marksRes = await fetch(`${import.meta.env.VITE_API_URL}/api/marks/fetch?${queryParams}`, {headers:{'Authorization':`Bearer ${token}`}});
      const existingMarks = await marksRes.json();

      const merged = Array.isArray(students) ? students.map(stud => {
        const row = { student_id: stud.id, name: stud.name, pen: stud.pen_number };
        cols.forEach(sub => {
          const found = existingMarks.find(m => m.student_id === stud.id && m.subject_id === sub.id);
          row[`marks_${sub.id}`] = (found && found.marks_obtained !== null && found.marks_obtained !== undefined) ? found.marks_obtained : '';
          row[`max_${sub.id}`] = (found && found.max_marks) ? found.max_marks : 100;
        });
        return row;
      }) : [];
      setStudentsGrid(merged);
      if (merged.length === 0) setMsg("No students found.");
    } catch(e){ console.error(e); setMsg("Error loading grid."); } finally { setLoading(false); }
  };

  const handleMarkChange = (studentId, subjectId, val) => {
    if (val > 100) return; 
    setStudentsGrid(prev => prev.map(row => row.student_id === studentId ? { ...row, [`marks_${subjectId}`]: val } : row));
  };

  const handleSave = async () => {
    setLoading(true); setMsg("Saving...");
    try {
      let savedCount = 0;
      for (const sub of activeSubjects) {
        const marksData = studentsGrid
          .filter(row => row[`marks_${sub.id}`] !== '' && row[`marks_${sub.id}`] !== undefined)
          .map(row => ({ student_id: row.student_id, marks: row[`marks_${sub.id}`], max_marks: row[`max_${sub.id}`] || 100 }));
        if (marksData.length > 0) {
          await fetch(`${import.meta.env.VITE_API_URL}/api/marks/bulk-update`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ exam_id: context.exam_id, subject_id: sub.id, marks_data: marksData }) });
          savedCount++;
        }
      }
      setMsg(`Saved marks for ${savedCount} subjects!`);
    } catch(e) { setMsg("Error saving marks."); } finally { setLoading(false); }
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || !context.district_id;
  const isSchoolLocked = user.role === 'school_admin' || !context.mandal_id;

  return (
    <div className="bg-white p-6 rounded shadow border max-w-6xl overflow-x-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PenTool className="text-blue-600"/> Marks Entry Grid</h2>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4 bg-gray-50 p-4 rounded min-w-[800px]">
          <select className={`p-2 border rounded text-sm ${isDistrictLocked?'bg-gray-100':''}`} value={context.district_id} onChange={e=>setContext({...context, district_id:e.target.value})} disabled={isDistrictLocked}><option value="">District</option>{lists.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select className={`p-2 border rounded text-sm ${isMandalLocked?'bg-gray-100':''}`} value={context.mandal_id} onChange={e=>setContext({...context, mandal_id:e.target.value})} disabled={isMandalLocked}><option value="">Mandal</option>{lists.mandals.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select className={`p-2 border rounded text-sm ${isSchoolLocked?'bg-gray-100':''}`} value={context.school_id} onChange={e=>setContext({...context, school_id:e.target.value})} disabled={isSchoolLocked}><option value="">School</option>{lists.schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          
          {/* HIGHLIGHT: Class Dropdown always enabled, independent of school */}
          <select className="p-2 border rounded text-sm" value={context.class_id} onChange={e=>setContext({...context, class_id:e.target.value})}>
            <option value="">Class</option>
            {lists.classes.map(c=><option key={c.id} value={c.id}>Grade {c.grade_level}</option>)}
          </select>
          
          <select className="p-2 border rounded text-sm" value={context.exam_id} onChange={e=>setContext({...context, exam_id:e.target.value})}><option value="">Exam</option>{lists.exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select className="p-2 border rounded text-sm" value={context.subject_id} onChange={e=>setContext({...context, subject_id:e.target.value})}><option value="">Subject</option><option value="all" className="font-bold text-blue-600">-- All Subjects --</option>{lists.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <button onClick={loadGrid} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold w-full md:w-auto">Load Students</button>
      
      {msg && <div className={`p-2 text-center mb-2 rounded ${msg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{msg}</div>}
      
      {studentsGrid.length > 0 && (
        <div className="animate-in fade-in">
          <div className="flex justify-end mb-2">
            <button onClick={handleSave} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700">
              {loading ? 'Saving...' : <><Save className="h-4 w-4"/> Save Marks</>}
            </button>
          </div>
          <div className="overflow-x-auto border rounded max-h-[600px]">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-gray-100 z-20 w-16 border-r text-center">S.No</th>
                  <th className="px-4 py-3 sticky left-16 bg-gray-100 z-20 w-32 border-r">PEN No.</th>
                  <th className="px-4 py-3 sticky left-48 bg-gray-100 z-20 w-48 border-r">Student Name</th>
                  {activeSubjects.map(sub => (<th key={sub.id} className="px-2 py-3 text-center min-w-[100px] border-r">{sub.name}</th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {studentsGrid.map((row, idx) => (
                  <tr key={row.student_id} className="hover:bg-blue-50 transition-colors group">
                    <td className="px-4 py-2 text-center text-gray-500 border-r sticky left-0 bg-white group-hover:bg-blue-50">{idx + 1}</td>
                    <td className="px-4 py-2 font-mono text-gray-500 border-r sticky left-16 bg-white group-hover:bg-blue-50">{row.pen}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 border-r sticky left-48 bg-white group-hover:bg-blue-50 truncate max-w-[200px]">{row.name}</td>
                    {activeSubjects.map(sub => (
                      <td key={sub.id} className="px-2 py-2 text-center border-r">
                        <input type="number" min="0" max="100" className="w-16 p-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 outline-none" 
                          value={row[`marks_${sub.id}`] !== undefined && row[`marks_${sub.id}`] !== null ? row[`marks_${sub.id}`] : ''}
                          onChange={(e) => handleMarkChange(row.student_id, sub.id, e.target.value)} placeholder="-" tabIndex={idx + 1} 
                        />
                      </td>
                    ))}
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