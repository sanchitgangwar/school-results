import { useState, useEffect } from 'react';
import { FileText, School } from 'lucide-react';

// ==========================================
// 1. ADD TEST FORM (Updated Layout & Logic)
// ==========================================
const AddTestForm = ({ user }) => {
  const [formData, setFormData] = useState({ 
    name: '', exam_code: '', start_date: '', end_date: '',
    name_telugu: '',
    district_id: user.district_id || '', 
    mandal_id: user.mandal_id || '', 
    school_id: user.school_id || '' 
  });
  
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  
  // Selection States
  const [selectedMandalIds, setSelectedMandalIds] = useState([]); 
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
  
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem('authToken');

  // 1. Always fetch districts (to display name even if locked)
  useEffect(() => {
    fetch('http://localhost:3000/api/entities/districts', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(setDistricts);
  }, []);

  // 2. Fetch Mandals & Schools when District Changes (or is pre-set)
  useEffect(() => {
    const dId = user.role === 'admin' ? formData.district_id : user.district_id;
    if (dId) {
      fetch(`http://localhost:3000/api/entities/mandals?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setMandals(Array.isArray(data) ? data : []));
      
      fetch(`http://localhost:3000/api/entities/schools?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setSchools(Array.isArray(data) ? data : []));
    }
  }, [formData.district_id, user.role]);

  // 3. Filter Schools Logic
  useEffect(() => {
    // If MEO, they are restricted to their own mandal, so we just show schools in that mandal
    if (user.role === 'meo') {
       const mySchools = schools.filter(s => s.mandal_id === user.mandal_id);
       setFilteredSchools(mySchools);
    } 
    // If Admin/DEO, filter based on the Mandals they checked
    else if (selectedMandalIds.length > 0) {
      const filtered = schools.filter(s => selectedMandalIds.includes(s.mandal_id));
      setFilteredSchools(filtered);
    } else {
      setFilteredSchools([]);
    }
  }, [selectedMandalIds, schools, user.role, user.mandal_id]);

  // Handlers
  const toggleMandal = (id) => setSelectedMandalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllMandals = () => selectedMandalIds.length === mandals.length ? setSelectedMandalIds([]) : setSelectedMandalIds(mandals.map(m => m.id));
  const toggleSchool = (id) => setSelectedSchoolIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllSchools = () => selectedSchoolIds.length === filteredSchools.length ? setSelectedSchoolIds([]) : setSelectedSchoolIds(filteredSchools.map(s => s.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // For School Admin, we auto-select their school if not already handled
    let finalSchoolIds = selectedSchoolIds;
    if (user.role === 'school_admin') finalSchoolIds = [user.school_id];

    if (finalSchoolIds.length === 0) { setMsg("Error: Please select target schools."); return; }

    setIsSubmitting(true); setMsg("Creating exams...");
    try {
      let successCount = 0;
      for (const schoolId of finalSchoolIds) {
        const payload = { 
          name: formData.name, 
          exam_code: formData.exam_code, 
          start_date: formData.start_date, 
          end_date: formData.end_date, 
          school_id: schoolId 
        };
        const res = await fetch('http://localhost:3000/api/entities/exams/add', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        if (res.ok) successCount++;
      }
      setMsg(`Successfully created exams for ${successCount} schools!`);
      setFormData({ ...formData, name: '', exam_code: '', start_date: '', end_date: '' }); setSelectedSchoolIds([]);
    } catch (err) { setMsg("Error submitting exams."); } finally { setIsSubmitting(false); }
  };

  // Permission Logic
  const isDistrictLocked = user.role !== 'admin';

  return (
    <div className="bg-white p-6 rounded shadow max-w-4xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><FileText className="text-blue-600" /> Create New Test</h2>
      {msg && <div className={`p-2 rounded mb-4 ${msg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: CONTEXT SELECTION (Moved to Top) */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 border-b pb-2">1. Select Schools</h3>
          
          {/* A. District (Visible to ALL, Locked for non-admins) */}
          <div className="mb-4">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">District</label>
             <select 
               className={`w-full p-2 border rounded text-sm ${isDistrictLocked ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-white'}`} 
               value={formData.district_id} 
               onChange={e => setFormData({...formData, district_id: e.target.value})} 
               required
               disabled={isDistrictLocked}
             >
               <option value="">-- Select District --</option>
               {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
          </div>

          {/* B. Mandal Selection */}
          {['admin', 'deo'].includes(user.role) && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700">Select Mandals</label>
                <button type="button" onClick={toggleAllMandals} className="text-xs text-blue-600 hover:underline">
                  {selectedMandalIds.length > 0 && selectedMandalIds.length === mandals.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="h-32 overflow-y-auto border rounded p-2 bg-white grid grid-cols-2 md:grid-cols-3 gap-2">
                 {mandals.length === 0 && <p className="text-xs text-gray-400 col-span-3 p-2">Select a district to see mandals</p>}
                 {mandals.map(m => (
                   <label key={m.id} className={`flex items-center p-2 rounded cursor-pointer border ${selectedMandalIds.includes(m.id) ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'}`}>
                     <input type="checkbox" className="mr-2" checked={selectedMandalIds.includes(m.id)} onChange={() => toggleMandal(m.id)} />
                     <span className="text-xs font-medium truncate">{m.name}</span>
                   </label>
                 ))}
              </div>
            </div>
          )}

          {/* MEO View: Single Mandal Locked */}
          {user.role === 'meo' && (
             <div className="mb-4">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mandal</label>
               <input className="w-full p-2 border rounded bg-gray-200 text-gray-600 text-sm" value={mandals.find(m => m.id === user.mandal_id)?.name || 'My Mandal'} disabled />
             </div>
          )}

          {/* C. School Selection */}
          {user.role !== 'school_admin' ? (
            <div>
               <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Select Target Schools</label>
                  <div className="flex gap-4">
                     <span className="text-xs text-gray-500 self-center">{selectedSchoolIds.length} selected</span>
                     <button type="button" onClick={toggleAllSchools} className="text-xs text-blue-600 hover:underline">
                       {selectedSchoolIds.length > 0 && selectedSchoolIds.length === filteredSchools.length ? 'Deselect All' : 'Select All'}
                     </button>
                  </div>
                </div>
                <div className="h-48 overflow-y-auto border rounded p-2 bg-white grid grid-cols-1 md:grid-cols-2 gap-2">
                   {filteredSchools.length === 0 && (
                     <div className="col-span-2 text-center py-8 text-gray-400 flex flex-col items-center">
                       <School className="h-8 w-8 mb-2 opacity-50" />
                       <p className="text-xs">No schools found. Check Mandal selection.</p>
                     </div>
                   )}
                   {filteredSchools.map(s => (
                     <label key={s.id} className={`flex items-start p-2 rounded cursor-pointer border transition-colors ${selectedSchoolIds.includes(s.id) ? 'bg-blue-100 border-blue-300' : 'border-gray-100 hover:border-blue-200'}`}>
                       <input type="checkbox" className="mt-1 mr-2" checked={selectedSchoolIds.includes(s.id)} onChange={() => toggleSchool(s.id)} />
                       <div className="overflow-hidden">
                         <span className="text-sm font-medium block truncate">{s.name}</span>
                         <span className="text-xs text-gray-500 block truncate">{s.udise_code}</span>
                       </div>
                     </label>
                   ))}
                </div>
            </div>
          ) : (
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">School</label>
               <input className="w-full p-2 border rounded bg-gray-200 text-gray-600 text-sm" value={schools.find(s => s.id === user.school_id)?.name || 'My School'} disabled />
            </div>
          )}
        </div>

        {/* SECTION 2: TEST DETAILS (Moved to Bottom) */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 border-b pb-2">2. Test Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Exam Name</label><input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Quarterly Exams 2025" /></div>
            <div><label className="block text-sm font-medium mb-1">Exam Name in Telugu</label><input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e => setFormData({...formData, name_telugu: e.target.value})} required placeholder="e.g. త్రైమాసిక పరీక్షలు 2025" /></div>
            <div><label className="block text-sm font-medium mb-1">Exam Code</label><input className="w-full p-2 border rounded" value={formData.exam_code} onChange={e => setFormData({...formData, exam_code: e.target.value})} required placeholder="e.g. Q1-2024-MATH" /></div>
            <div><label className="block text-sm font-medium mb-1">Start Date</label><input type="date" className="w-full p-2 border rounded" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium mb-1">End Date</label><input type="date" className="w-full p-2 border rounded" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required /></div>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting || (user.role !== 'school_admin' && selectedSchoolIds.length === 0)} className="bg-blue-600 text-white px-6 py-3 rounded w-full font-bold hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? 'Creating Tests...' : 'Create Test'}
        </button>
      </form>
    </div>
  );
};

export default AddTestForm;