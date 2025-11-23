import { useState } from 'react';
import { FileText } from 'lucide-react';

// ==========================================
// 1. ADD TEST FORM (Updated Layout & Logic)
// ==========================================
const AddTestForm = ({ user }) => {
  const [formData, setFormData] = useState({ 
    name: '', 
    exam_code: '', 
    start_date: '', 
    end_date: ''
  });
  
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem('authToken');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); 
    setMsg("Creating global exam...");
    
    try {
      // Payload now only contains exam details
      const payload = { ...formData };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/entities/exams/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create exam");

      setMsg(`Successfully created Global Exam: ${formData.name}`);
      setFormData({ name: '', exam_code: '', start_date: '', end_date: '' });
    } catch (err) { 
      setMsg("Error submitting exam."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-3xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <FileText className="text-blue-600" /> Create Global Test
      </h2>
      
      <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-6 text-sm text-blue-800">
        This exam will be available to <strong>all schools</strong> in the system. Subjects are not configured here.
      </div>

      {msg && <div className={`p-2 rounded mb-4 ${msg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* 1. EXAM DETAILS */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 border-b pb-2">1. Exam Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Exam Name</label><input className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Quarterly Exams 2025" /></div>
            <div><label className="block text-sm font-medium mb-1">Exam Name in Telugu</label><input className="w-full p-2 border rounded" value={formData.name_telugu} onChange={e => setFormData({...formData, name_telugu: e.target.value})} required placeholder="e.g. త్రైమాసిక పరీక్షలు 2025" /></div>
            <div><label className="block text-sm font-medium mb-1">Exam Code</label><input className="w-full p-2 border rounded" value={formData.exam_code} onChange={e => setFormData({...formData, exam_code: e.target.value})} required placeholder="e.g. Q1-2024-GLOBAL" /></div>
            <div><label className="block text-sm font-medium mb-1">Start Date</label><input type="date" className="w-full p-2 border rounded" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium mb-1">End Date</label><input type="date" className="w-full p-2 border rounded" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required /></div>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-3 rounded w-full font-bold hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? 'Creating...' : 'Create Global Exam'}
        </button>
      </form>
    </div>
  );
};

export default AddTestForm;