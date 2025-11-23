import { useState, useEffect } from 'react';
import { 
  Printer, Globe, School, Users, FileText, Phone, Mail, 
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus 
} from 'lucide-react';

// --- 1. MANAGE USERS COMPONENT (Updated with Dropdowns) ---
const ManageUsers = ({ currentUser }) => {
  const [formData, setFormData] = useState({
    username: '', password: '', role: 'school_admin', full_name: '',
    district_id: currentUser.district_id || '',
    mandal_id: currentUser.mandal_id || '',
    school_id: currentUser.school_id || ''
  });
  
  // Dropdown Data
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [schools, setSchools] = useState([]);
  
  const [msg, setMsg] = useState('');

  // --- FETCHING LOGIC ---
  const token = localStorage.getItem('authToken');

  // 1. Fetch Districts (Admin Only)
  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/districts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setDistricts(Array.isArray(data) ? data : []))
      .catch(console.error);
    }
  }, [currentUser, token]);

  // 2. Fetch Mandals (Dependent on District)
  useEffect(() => {
    // If I am Admin, use the selected district. If I am DEO, use my own district.
    const activeDistrictId = currentUser.role === 'admin' ? formData.district_id : currentUser.district_id;

    if (activeDistrictId) {
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/mandals?district_id=${activeDistrictId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setMandals(Array.isArray(data) ? data : []))
      .catch(console.error);
    } else {
      setMandals([]);
    }
  }, [formData.district_id, currentUser, token]);

  // 3. Fetch Schools (Dependent on Mandal)
  useEffect(() => {
    // If I am Admin/DEO, use selected mandal. If MEO, use my own.
    const activeMandalId = ['admin', 'deo'].includes(currentUser.role) ? formData.mandal_id : currentUser.mandal_id;

    if (activeMandalId) {
      fetch(`${import.meta.env.VITE_API_URL}/api/entities/schools?mandal_id=${activeMandalId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(console.error);
    } else {
      setSchools([]);
    }
  }, [formData.mandal_id, currentUser, token]);


  // Determine allowed roles to create based on hierarchy
  const getAllowedRoles = () => {
    const roles = [
      { val: 'deo', label: 'District Education Officer' },
      { val: 'meo', label: 'Mandal Education Officer' },
      { val: 'school_admin', label: 'School Admin/Headmaster' }
    ];
    
    if (currentUser.role === 'admin') return roles;
    if (currentUser.role === 'deo') return roles.slice(1); 
    if (currentUser.role === 'meo') return roles.slice(2); 
    return []; 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/create-user`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "Failed to create user");
      setMsg('User created successfully!');
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow border border-gray-200 max-w-4xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Users className="h-6 w-6 text-blue-600" />
        Create New User Login
      </h2>
      {msg && <div className={`p-3 mb-4 rounded ${msg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">User Role To Create</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            value={formData.role}
            onChange={e => setFormData({...formData, role: e.target.value})}
          >
            {getAllowedRoles().map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
          </select>
        </div>

        {/* --- DYNAMIC DROPDOWNS --- */}

        {/* District Dropdown (Admin Only) */}
        {['admin'].includes(currentUser.role) && (
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Select District</label>
             <select 
               className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
               value={formData.district_id}
               onChange={e => setFormData({...formData, district_id: e.target.value, mandal_id: '', school_id: ''})}
               required
             >
               <option value="">-- Select District --</option>
               {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
           </div>
        )}

        {/* Mandal Dropdown (Admin & DEO) - Hidden if creating DEO */}
        {['admin', 'deo'].includes(currentUser.role) && formData.role !== 'deo' && (
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Select Mandal</label>
             <select 
               className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
               value={formData.mandal_id}
               onChange={e => setFormData({...formData, mandal_id: e.target.value, school_id: ''})}
               required={formData.role !== 'deo'}
               disabled={!formData.district_id && currentUser.role === 'admin'}
             >
               <option value="">-- Select Mandal --</option>
               {mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>
           </div>
        )}

        {/* School Dropdown (Admin, DEO, MEO) - Visible only if creating School Admin */}
        {formData.role === 'school_admin' && (
           <div className="col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">Select School</label>
             <select 
               className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
               value={formData.school_id}
               onChange={e => setFormData({...formData, school_id: e.target.value})}
               required
               disabled={(!formData.mandal_id && ['admin', 'deo'].includes(currentUser.role))}
             >
               <option value="">-- Select School --</option>
               {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
           </div>
        )}

        {/* Basic Creds */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" required 
            onChange={e => setFormData({...formData, username: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" required 
             onChange={e => setFormData({...formData, password: e.target.value})} 
          />
        </div>
        <div className="col-span-2">
           <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
           <input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500" required 
              onChange={e => setFormData({...formData, full_name: e.target.value})} 
           />
        </div>

        <button type="submit" className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-medium">
          Create User
        </button>
      </form>
    </div>
  );
};

export default ManageUsers;