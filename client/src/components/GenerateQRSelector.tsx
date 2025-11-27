import { useState, useEffect } from 'react';
import { QrCode, Printer } from 'lucide-react';

// ==========================================
// 2. GENERATE QR SELECTOR (Updated with Class Filter)
// ==========================================
// ... (GenerateQRSelector Update: Fetch classes globally on mount) ...
const GenerateQRSelector = ({ user }) => {
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]); 
  
  const [context, setContext] = useState({
    district_id: user.district_id || '',
    mandal_id: user.mandal_id || '',
    school_id: user.school_id || '',
    class_id: 'all'
  });

  const token = localStorage.getItem('authToken');

  useEffect(() => { fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setDistricts(Array.isArray(d) ? d : [])); }, []);
  
  // HIGHLIGHT: Fetch Classes Globally
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/classes`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => setClasses(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { const dId = user.role === 'admin' ? context.district_id : user.district_id; if (dId) { fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setMandals(Array.isArray(d) ? d : [])); } }, [context.district_id, user.role, user.district_id]);
  useEffect(() => { const mId = ['admin', 'deo'].includes(user.role) ? context.mandal_id : user.mandal_id; if (mId) { fetch(`${import.meta.env.VITE_API_URL}/api/entities/schools?mandal_id=${mId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setSchools(Array.isArray(d) ? d : [])); } }, [context.mandal_id, user.role, user.mandal_id]);

  const handleGenerate = () => {
    const targetSchoolId = ['admin', 'deo', 'meo'].includes(user.role) ? context.school_id : user.school_id;
    if (!targetSchoolId) return alert("Please select a school first.");
    window.open(`/print-qrs/${targetSchoolId}?class_id=${context.class_id}`, '_blank');
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || (!context.district_id && user.role === 'admin');
  const isSchoolLocked = user.role === 'school_admin' || (!context.mandal_id && ['admin', 'deo'].includes(user.role));

  return (
    <div className="bg-white p-6 rounded shadow border border-gray-200 max-w-2xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><QrCode className="h-6 w-6 text-purple-600"/> Generate QR Stickers</h2>
      <div className="bg-purple-50 p-4 rounded mb-6 text-purple-800 text-sm">Select a school and optionally a specific class to generate individual QR code stickers.</div>
      <div className="space-y-4">
        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">District</label><select className={`w-full p-2 border rounded ${isDistrictLocked ? 'bg-gray-100' : ''}`} value={context.district_id} onChange={e => setContext({...context, district_id: e.target.value, mandal_id: '', school_id: '', class_id: 'all'})} disabled={isDistrictLocked}><option value="">Select District</option>{districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mandal</label><select className={`w-full p-2 border rounded ${isMandalLocked ? 'bg-gray-100' : ''}`} value={context.mandal_id} onChange={e => setContext({...context, mandal_id: e.target.value, school_id: '', class_id: 'all'})} disabled={isMandalLocked}><option value="">Select Mandal</option>{mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">School</label><select className={`w-full p-2 border rounded ${isSchoolLocked ? 'bg-gray-100' : ''}`} value={context.school_id} onChange={e => setContext({...context, school_id: e.target.value, class_id: 'all'})} disabled={isSchoolLocked}><option value="">Select School</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        
        {/* Class Dropdown - Global */}
        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class (Optional)</label><select className="w-full p-2 border rounded" value={context.class_id} onChange={e => setContext({...context, class_id: e.target.value})}><option value="all">All Classes</option>{classes.map(c => (<option key={c.id} value={c.id}>Grade {c.grade_level}</option>))}</select></div>
        
        <button onClick={handleGenerate} disabled={user.role !== 'school_admin' && !context.school_id} className="w-full bg-purple-600 text-white py-3 rounded font-bold hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center gap-2 mt-4"><Printer className="h-5 w-5" /> Open Print View</button>
      </div>
    </div>
  );
};

export default GenerateQRSelector;