import { useState, useEffect } from 'react';
import { Building } from 'lucide-react';

// ==========================================
// 1. ADD SCHOOL FORM (Updated with Telugu Fields)
// ==========================================
const AddSchoolForm = ({ user }) => {
  const [formData, setFormData] = useState({ 
    name: '', 
    name_telugu: '',     // Added
    udise_code: '', 
    address: '', 
    address_telugu: '',  // Added
    district_id: user.district_id || '', 
    mandal_id: user.mandal_id || '' 
  });
  
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  useEffect(() => { fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(setDistricts); }, []);
  useEffect(() => { const dId = user.role === 'admin' ? formData.district_id : user.district_id; if (dId) fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(setMandals); }, [formData.district_id, user.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/schools/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if(!res.ok) throw new Error("Failed");
      setMsg('School added successfully!');
      setFormData({ ...formData, name: '', name_telugu: '', udise_code: '', address: '', address_telugu: '' });
    } catch (err) { setMsg('Error adding school'); }
  };

  const isDistrictLocked = user.role !== 'admin';
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || (!formData.district_id && user.role === 'admin');

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Building className="text-blue-600" /> Add School</h2>
      {msg && <div className="p-2 bg-green-50 text-green-700 mb-4 rounded">{msg}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">District</label><select className={`w-full p-2 border rounded ${isDistrictLocked?'bg-gray-100 text-gray-600':''}`} value={formData.district_id} onChange={e=>setFormData({...formData, district_id:e.target.value})} disabled={isDistrictLocked}><option value="">Select</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Mandal</label><select className={`w-full p-2 border rounded ${isMandalLocked?'bg-gray-100 text-gray-600':''}`} value={formData.mandal_id} onChange={e=>setFormData({...formData, mandal_id:e.target.value})} disabled={isMandalLocked}><option value="">Select</option>{mandals.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        </div>
        
        {/* School Names */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">School Name (English)</label>
            <input className="w-full p-2 border rounded" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School Name (Telugu)</label>
            <input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e=>setFormData({...formData, name_telugu:e.target.value})} placeholder="Optional" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">UDISE Code</label>
          <input className="w-full p-2 border rounded" value={formData.udise_code} onChange={e=>setFormData({...formData, udise_code:e.target.value})} required />
        </div>

        {/* School Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Address (English)</label>
            <input className="w-full p-2 border rounded" value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address (Telugu)</label>
            <input className="w-full p-2 border rounded" value={formData.address_telugu} onChange={e=>setFormData({...formData, address_telugu:e.target.value})} placeholder="Optional" />
          </div>
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Save School</button>
      </form>
    </div>
  );
};

export default AddSchoolForm;