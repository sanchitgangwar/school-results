import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

const AddMandalForm = ({ user }) => {
  const [formData, setFormData] = useState({ name: '', name_telugu: '', district_id: user.district_id || '' });
  const [districts, setDistricts] = useState([]);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  // Always fetch districts. Backend filters the list if user is DEO.
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(setDistricts);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if(!res.ok) throw new Error("Failed");
      setMsg('Mandal added successfully!'); setFormData({ ...formData, name: '' });
    } catch (err) { setMsg('Error adding mandal'); }
  };

  const isDistrictLocked = user.role !== 'admin';

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-blue-600" /> Add Mandal</h2>
      {msg && <div className="p-2 bg-green-50 text-green-700 mb-4 rounded">{msg}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Select District</label>
          <select 
            className={`w-full p-2 border rounded ${isDistrictLocked ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
            value={formData.district_id} 
            onChange={e => setFormData({...formData, district_id: e.target.value})} 
            required
            disabled={isDistrictLocked}
          >
            <option value="">-- Select --</option>
            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium mb-1">Mandal Name</label><input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
        <div><label className="block text-sm font-medium mb-1">Mandal Name in Telugu</label><input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e => setFormData({...formData, name_telugu: e.target.value})} required /></div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save Mandal</button>
      </form>
    </div>
  );
};

export default AddMandalForm;