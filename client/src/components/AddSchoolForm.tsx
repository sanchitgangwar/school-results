import { useState, useEffect } from 'react';
import { Building } from 'lucide-react';

const AddSchoolForm = ({ user }) => {
  const [formData, setFormData] = useState({ 
    name: '', 
    name_telugu: '',
    udise_code: '', 
    address: '', 
    district_id: user.district_id || '', 
    mandal_id: user.mandal_id || '' 
  });
  const [selectedGrades, setSelectedGrades] = useState([]);
  
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('authToken');

  // 1. Fetch Districts (Always visible for name resolution)
  useEffect(() => {
    fetch('http://localhost:3000/api/entities/districts', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(setDistricts);
  }, []);

  // 2. Fetch Mandals based on selected/locked district
  useEffect(() => {
    const dId = user.role === 'admin' ? formData.district_id : user.district_id;
    if (dId) {
      fetch(`http://localhost:3000/api/entities/mandals?district_id=${dId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json()).then(setMandals);
    }
  }, [formData.district_id, user.role, user.district_id]);

  const toggleGrade = (grade) => {
    setSelectedGrades(prev => 
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      grades: selectedGrades
    };

    try {
      // Use the new specific endpoint that handles class creation
      const res = await fetch('http://localhost:3000/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if(!res.ok) throw new Error("Failed to create school");
      
      setMsg('School and classes added successfully!'); 
      setFormData({ ...formData, name: '', udise_code: '', address: '' });
      setSelectedGrades([]);
    } catch (err) { 
      setMsg('Error adding school'); 
    }
  };

  const isDistrictLocked = user.role !== 'admin';
  // Mandal locked if not admin, or if district hasn't been picked by admin yet
  const isMandalLocked = ['school_admin', 'meo'].includes(user.role) || (!formData.district_id && user.role === 'admin');

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Building className="text-blue-600" /> Add School
      </h2>
      
      {msg && <div className="p-2 bg-green-50 text-green-700 mb-4 rounded">{msg}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* CONTEXT */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">District</label>
            <select 
              className={`w-full p-2 border rounded ${isDistrictLocked ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
              value={formData.district_id} 
              onChange={e => setFormData({...formData, district_id: e.target.value})} 
              disabled={isDistrictLocked}
              required
            >
              <option value="">-- Select --</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Mandal</label>
            <select 
              className={`w-full p-2 border rounded ${isMandalLocked ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
              value={formData.mandal_id} 
              onChange={e => setFormData({...formData, mandal_id: e.target.value})} 
              disabled={isMandalLocked}
              required
            >
              <option value="">-- Select --</option>
              {mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {/* DETAILS */}
        <div>
          <label className="block text-sm font-medium mb-1">School Name</label>
          <input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. ZPHS High School" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">School Name in Telugu</label>
          <input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e => setFormData({...formData, name_telugu: e.target.value})} required placeholder="e.g. ZPHS హై స్కూల్" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">UDISE Code</label>
          <input className="w-full p-2 border rounded" value={formData.udise_code} onChange={e => setFormData({...formData, udise_code: e.target.value})} required />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input className="w-full p-2 border rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address in Telugu</label>
            <input className="w-full p-2 border rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
        </div>

        {/* CLASSES SELECTION */}
        <div className="border-t pt-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">Select Classes to Create</label>
          <div className="flex gap-4 flex-wrap">
            {[6, 7, 8, 9, 10, 11, 12].map(grade => (
              <label key={grade} className={`flex items-center px-3 py-2 border rounded cursor-pointer transition-colors ${selectedGrades.includes(grade) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'}`}>
                <input 
                  type="checkbox" 
                  className="mr-2"
                  checked={selectedGrades.includes(grade)}
                  onChange={() => toggleGrade(grade)}
                />
                <span className="font-medium">Class {grade}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">Select at least one class to initialize the school.</p>
        </div>

        <button type="submit" disabled={selectedGrades.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          Save School & Classes
        </button>
      </form>
    </div>
  );
};

export default AddSchoolForm;