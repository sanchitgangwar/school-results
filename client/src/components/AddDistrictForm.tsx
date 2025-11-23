import { useState } from 'react';
import { Map } from 'lucide-react';

const AddDistrictForm = ({ user }) => {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch('http://localhost:3000/api/entities/districts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, state: 'Telangana' })
      });
      if(!res.ok) throw new Error("Failed");
      setMsg('District added successfully!'); setName('');
    } catch (err) { setMsg('Error adding district'); }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-2xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Map className="text-blue-600" /> Add District</h2>
      {msg && <div className="p-2 bg-green-50 text-green-700 mb-4 rounded">{msg}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">District Name</label><input className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Narayanpet" /></div>
        <div><label className="block text-sm font-medium mb-1">State</label><input className="w-full p-2 border rounded bg-gray-100 text-gray-500" value="Telangana" disabled /></div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save District</button>
      </form>
    </div>
  );
};

export default AddDistrictForm;