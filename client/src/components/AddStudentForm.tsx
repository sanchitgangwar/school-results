import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';

const AddStudentForm = ({ user }) => {
  const [formData, setFormData] = useState({
    name: '', name_telugu: '', gender: 'Male', pen_number: '', 
    date_of_birth: '', parent_phone: '', 
    district_id: user.district_id || '', 
    mandal_id: user.mandal_id || '', 
    school_id: user.school_id || '',
    class_id: '' 
  });

  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  // 1. Fetch Districts (Always fetch to show labels)
  useEffect(() => {
    fetch('http://localhost:3000/api/entities/districts', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(setDistricts);
  }, []);

  // 2. Fetch Mandals
  useEffect(() => {
    const dId = user.role === 'admin' ? formData.district_id : user.district_id;
    if (dId) {
      fetch(`http://localhost:3000/api/entities/mandals?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(setMandals);
    }
  }, [formData.district_id, user.role, user.district_id]);

  // 3. Fetch Schools
  useEffect(() => {
    const mId = ['admin', 'deo'].includes(user.role) ? formData.mandal_id : user.mandal_id;
    if (mId) {
      fetch(`http://localhost:3000/api/entities/schools?mandal_id=${mId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(setSchools);
    }
  }, [formData.mandal_id, user.role, user.mandal_id]);

  // 4. Fetch Classes (When School is selected)
  useEffect(() => {
    const sId = ['admin', 'deo', 'meo'].includes(user.role) ? formData.school_id : user.school_id;
    if (sId) {
      // Assuming a generic endpoint exists or specific one for classes
      fetch(`http://localhost:3000/api/entities/classes?school_id=${sId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(data => setClasses(Array.isArray(data) ? data : []));
    } else {
      setClasses([]);
    }
  }, [formData.school_id, user.role, user.school_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/entities/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      if(!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add student");
      }
      
      setMsg('Student added successfully!');
      // Reset student specific fields but keep context
      setFormData(prev => ({ 
        ...prev, 
        name: '', name_telugu: '', pen_number: '', date_of_birth: '', parent_phone: '' 
      }));
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || !formData.district_id;
  const isSchoolLocked = user.role === 'school_admin' || !formData.mandal_id;

  return (
    <div className="bg-white p-6 rounded shadow max-w-4xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <UserPlus className="text-blue-600" /> Add New Student
      </h2>
      
      {msg && <div className={`p-3 mb-4 rounded ${msg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CONTEXT SELECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6 bg-gray-50 p-4 rounded">
           <div>
             <label className="block text-xs font-bold uppercase text-gray-500 mb-1">District</label>
             <select className={`w-full p-2 border rounded text-sm ${isDistrictLocked ? 'bg-gray-200' : 'bg-white'}`} value={formData.district_id} onChange={e => setFormData({...formData, district_id: e.target.value})} disabled={isDistrictLocked}>
               <option value="">Select District</option>
               {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Mandal</label>
             <select className={`w-full p-2 border rounded text-sm ${isMandalLocked ? 'bg-gray-200' : 'bg-white'}`} value={formData.mandal_id} onChange={e => setFormData({...formData, mandal_id: e.target.value})} disabled={isMandalLocked}>
               <option value="">Select Mandal</option>
               {mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold uppercase text-gray-500 mb-1">School</label>
             <select className={`w-full p-2 border rounded text-sm ${isSchoolLocked ? 'bg-gray-200' : 'bg-white'}`} value={formData.school_id} onChange={e => setFormData({...formData, school_id: e.target.value})} disabled={isSchoolLocked}>
               <option value="">Select School</option>
               {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Class / Section</label>
             <select className="w-full p-2 border rounded text-sm bg-white" value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} required disabled={!formData.school_id}>
               <option value="">Select Class</option>
               {classes.map(c => <option key={c.id} value={c.id}>{c.grade_level} - {c.section_name}</option>)}
             </select>
           </div>
        </div>

        {/* STUDENT DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student Name (English)</label>
            <input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Ravi Kumar" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Student Name (Telugu)</label>
            <input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e => setFormData({...formData, name_telugu: e.target.value})} placeholder="e.g. రవి కుమార్" />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">PEN Number</label>
            <input className="w-full p-2 border rounded font-mono" value={formData.pen_number} onChange={e => setFormData({...formData, pen_number: e.target.value})} required placeholder="Unique ID" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <select className="w-full p-2 border rounded" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date of Birth</label>
            <input type="date" className="w-full p-2 border rounded" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Parent Phone</label>
            <input type="tel" pattern="[0-9]{10}" className="w-full p-2 border rounded" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} required placeholder="10 digit mobile" />
          </div>
        </div>

        <button type="submit" disabled={!formData.school_id} className="bg-blue-600 text-white px-6 py-2 rounded w-full font-bold hover:bg-blue-700 disabled:opacity-50">
          Save Student
        </button>
      </form>
    </div>
  );
};

export default AddStudentForm;