import { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Upload, Loader } from 'lucide-react';

// ==========================================
// 1. BULK UPLOAD COMPONENT (Updated with Subject)
// ==========================================
const BulkUploadMarks = ({ user }) => {
  const [context, setContext] = useState({
    district_id: user.district_id || '',
    mandal_id: user.mandal_id || '',
    school_id: user.school_id || '',
    exam_id: '',
    subject_id: '' // Added Subject ID
  });

  const [lists, setLists] = useState({ districts: [], mandals: [], schools: [], exams: [], subjects: [], students: [] });
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); 
  const [logs, setLogs] = useState([]);
  const token = localStorage.getItem('authToken');

  // --- DROPDOWN FETCHES ---
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
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/exams?school_id=${context.school_id}`, { headers: h })
        .then(res => res.json()).then(data => setLists(p => ({ ...p, exams: Array.isArray(data) ? data : [] })));
      
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/subjects`, { headers: h })
        .then(res => res.json()).then(data => setLists(p => ({ ...p, subjects: Array.isArray(data) ? data : [] })));

      fetch(`${import.meta.env.VITE_API_URL}/api/entities/students?school_id=${context.school_id}`, { headers: h })
        .then(res => res.json()).then(data => setLists(p => ({ ...p, students: Array.isArray(data) ? data : [] })));
    }
  }, [context.school_id]);


  // --- 2. SMART TEMPLATE GENERATOR ---
  const downloadTemplate = () => {
    const activeSchool = lists.schools.find(s => s.id === context.school_id) || { name: 'SCHOOL_NAME', udise_code: 'UDISE' };
    const activeExam = lists.exams.find(e => e.id === context.exam_id) || { name: 'TEST_NAME' };
    const activeSubject = lists.subjects.find(s => s.id === context.subject_id) || { name: '' };

    const headers = [
      'SCHOOL_NAME', 'UDISE_CODE', 'TEST_NAME', 
      'PEN_NUMBER', 'STUDENT_NAME',             
      'SUBJECT_NAME', 'MARKS_OBTAINED', 'MAX_MARKS', 'GRADE'
    ];
    
    let rows = [];

    if (lists.students.length > 0) {
      // Pre-fill rows with students AND the selected subject
      rows = lists.students.map(s => [
        `"${activeSchool.name}"`, 
        `"${activeSchool.udise_code}"`,
        `"${activeExam.name}"`,
        `"${s.pen_number}"`,
        `"${s.name}"`,
        `"${activeSubject.name}"`, // Pre-filled Subject Name
        '', // Marks (Blank for entry)
        '100'
      ]);
    } else {
      rows = [
        ['""', '""', '""', '""', '""', `"${activeSubject.name || 'Mathematics'}"`, '', '']
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Marks_${activeSubject.name || 'Subject'}_${activeSchool.udise_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 3. FILE PARSING ---
  const handleFileUpload = async () => {
    if (!file || !context.exam_id) {
      setLogs(["Error: Please select Exam, Subject and File."]);
      return;
    }
    setUploadStatus('processing');
    setLogs(["Reading file..."]);

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = String(text).split("\n").map(row => {
        const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : [];
      });
      
      const dataRows = rows.slice(1).filter(r => r.length >= 4 && r[3]); 

      const payloadBatch = [];
      const errorLogs = [];

      dataRows.forEach((row, idx) => {
        // Indices: 3:PEN, 5:Subject, 6:Marks, 7:Max, 8:Grade
        const pen = row[3];
        const subName = row[5];
        const marks = row[6];
        const max = row[7];
        const grade = row[8] || ''; // Read Grade
        
        const student = lists.students.find(s => s.pen_number === pen);
        if (!student) {
          errorLogs.push(`Row ${idx+2}: Student PEN '${pen}' not found.`);
          return;
        }

        let subjectId = lists.subjects.find(s => s.name.toLowerCase() === subName?.toLowerCase())?.id;
        if (!subjectId && context.subject_id) subjectId = context.subject_id; 

        if (!subjectId) {
          errorLogs.push(`Row ${idx+2}: Subject '${subName}' unknown.`);
          return;
        }

        if (isNaN(parseFloat(marks)) || marks === '') {
           if(marks !== '') errorLogs.push(`Row ${idx+2}: Invalid marks '${marks}'.`);
           return;
        }

        payloadBatch.push({
          student_id: student.id,
          subject_id: subjectId,
          marks: parseFloat(marks),
          max_marks: parseFloat(max) || 100,
          grade: grade // Include grade
        });
      });

      if (payloadBatch.length === 0) {
        setUploadStatus('error');
        setLogs(["No valid data rows found.", ...errorLogs]);
        return;
      }

      const groupedBySubject = {};
      payloadBatch.forEach(item => {
        if (!groupedBySubject[item.subject_id]) groupedBySubject[item.subject_id] = [];
        groupedBySubject[item.subject_id].push(item);
      });

      setLogs(prev => [...prev, `Found ${payloadBatch.length} valid marks. Uploading...`]);
      
      try {
        for (const [subId, marksData] of Object.entries(groupedBySubject)) {
           const res = await fetch(`${import.meta.env.VITE_API_URL}/api/marks/bulk-update`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
             body: JSON.stringify({
               exam_id: context.exam_id,
               subject_id: subId,
               marks_data: marksData
             })
           });
           if (!res.ok) throw new Error("API Error");
        }
        setUploadStatus('success');
        setLogs(prev => [...prev, "Success! Database updated.", ...errorLogs]);
      } catch (err) {
        setUploadStatus('error');
        setLogs(prev => [...prev, "Server Error.", ...errorLogs]);
      }
    };

    reader.readAsText(file);
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || !context.district_id;
  const isSchoolLocked = user.role === 'school_admin' || !context.mandal_id;

  return (
    <div className="bg-white p-6 rounded shadow border border-gray-200 max-w-4xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6 text-green-600"/> Bulk Upload Marks
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Context Selection */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 border-b pb-2">1. Select Context</h3>
          
          <div><label className="text-xs font-bold text-gray-500 uppercase">District</label>
          <select className={`w-full p-2 border rounded ${isDistrictLocked?'bg-gray-100':''}`} value={context.district_id} onChange={e=>setContext({...context, district_id:e.target.value})} disabled={isDistrictLocked}><option value="">Select District</option>{lists.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>

          <div><label className="text-xs font-bold text-gray-500 uppercase">Mandal</label>
          <select className={`w-full p-2 border rounded ${isMandalLocked?'bg-gray-100':''}`} value={context.mandal_id} onChange={e=>setContext({...context, mandal_id:e.target.value})} disabled={isMandalLocked}><option value="">Select Mandal</option>{lists.mandals.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>

          <div><label className="text-xs font-bold text-gray-500 uppercase">School</label>
          <select className={`w-full p-2 border rounded ${isSchoolLocked?'bg-gray-100':''}`} value={context.school_id} onChange={e=>setContext({...context, school_id:e.target.value})} disabled={isSchoolLocked}><option value="">Select School</option>{lists.schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>

          <div><label className="text-xs font-bold text-gray-500 uppercase">Test / Exam</label>
          <select className="w-full p-2 border rounded" value={context.exam_id} onChange={e=>setContext({...context, exam_id:e.target.value})} disabled={!context.school_id}><option value="">Select Exam</option>{lists.exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>

          <div><label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
          <select className="w-full p-2 border rounded" value={context.subject_id} onChange={e=>setContext({...context, subject_id:e.target.value})} disabled={!context.school_id}><option value="">Select Subject</option>{lists.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>

        {/* RIGHT: File Actions */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 border-b pb-2">2. Upload File</h3>
          
          <div className="bg-blue-50 p-4 rounded border border-blue-100">
             <h4 className="font-bold text-blue-800 text-sm mb-2">Instructions:</h4>
             <ul className="list-disc list-inside text-xs text-blue-700 space-y-1">
               <li>Select <strong>Subject</strong> to pre-fill the template.</li>
               <li>Download the <strong>Smart Template</strong>.</li>
               <li>Fill in <strong>Marks</strong> for each student.</li>
               <li>Do not change PEN numbers.</li>
             </ul>
             <button onClick={downloadTemplate} disabled={!context.subject_id} className="mt-3 flex items-center gap-2 bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded text-sm hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">
               <Download className="h-4 w-4" /> Download Template
             </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Select CSV File</label>
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} className="w-full p-2 border rounded bg-gray-50"/>
          </div>

          <button 
            onClick={handleFileUpload}
            disabled={!file || !context.exam_id || uploadStatus === 'processing'}
            className="w-full flex justify-center items-center gap-2 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {uploadStatus === 'processing' ? <Loader className="animate-spin h-5 w-5"/> : <Upload className="h-5 w-5" />}
            Upload Marks
          </button>
        </div>
      </div>

      {/* LOGS */}
      {logs.length > 0 && (
        <div className="mt-6 bg-gray-900 text-gray-100 p-4 rounded text-xs font-mono h-40 overflow-y-auto">
           <div className="font-bold border-b border-gray-700 pb-1 mb-2">Processing Logs:</div>
           {logs.map((l, i) => <div key={i} className={l.includes('Error') ? 'text-red-400' : 'text-green-400'}>{l}</div>)}
        </div>
      )}
    </div>
  );
};

export default BulkUploadMarks;