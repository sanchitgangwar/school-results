import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { Loader, Printer } from 'lucide-react';
import telanganaLogo from '../../assets/Telangana-LOGO.png';

// ==========================================
// 1. QR CODE PRINT PAGE (Updated)
// ==========================================
const QRCodePrintView = () => {
  const { schoolId } = useParams();
  const [searchParams] = useSearchParams(); 
  const classId = searchParams.get('class_id') || 'all'; 

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('authToken');
      try {
        const res = await fetch(`http://localhost:3000/api/schools/${schoolId}/qr-data?class_id=${classId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load student data");
        const data = await res.json();
        setStudents(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId, classId]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader className="animate-spin h-8 w-8 text-blue-600"/></div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;

  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-4 print:bg-white">
      {/* No-Print Header */}
      <div className="mb-8 flex justify-between items-center max-w-5xl mx-auto print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Result Access Cards</h1>
          <p className="text-gray-600">
            {students.length} students found 
            {students[0] && <span> for {students[0].school_name}</span>}
          </p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold"
        >
          <Printer className="h-5 w-5" /> Print Stickers
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No students found for the selected criteria.</div>
      ) : (
        // GRID: 3 Columns, Fixed Gap
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid print:grid-cols-3 print:gap-2">
          {students.map((student) => {
            const link = `${baseUrl}/student/${student.parent_access_token}`;
            const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(link)}&size=150&margin=1`;

            return (
              <div 
                key={student.parent_access_token} 
                className="bg-white border-2 border-gray-400 rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid print:border print:border-black print:rounded-lg print:shadow-none shadow-sm relative overflow-hidden"
                style={{ 
                  pageBreakInside: 'avoid', 
                  height: '260px', // Increased fixed height to accommodate logo & full name
                  boxSizing: 'border-box'
                }}
              >
                {/* Header: Logo + School Name */}
                <div className="w-full flex items-center justify-between border-b-2 border-gray-200 pb-2 mb-2">
                  <img src={telanganaLogo} className="h-10 w-auto object-contain flex-shrink-0" alt="Logo" />
                  <div className="flex-grow text-right pl-2 overflow-hidden">
                    <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-wider leading-tight">
                      {student.school_name}
                    </h3>
                    <p className="text-[9px] text-gray-400 font-medium">Govt of Telangana</p>
                  </div>
                </div>

                {/* Body: Student Details */}
                <div className="flex-grow flex flex-col justify-start items-center w-full px-1">
                  {/* Name: Allowed to wrap, adjusted line-height */}
                  <h2 className="text-sm font-bold text-gray-900 leading-tight text-center w-full break-words mb-1">
                    {student.student_name}
                  </h2>
                  
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-0 text-xs text-gray-700 font-medium">
                    <span>Class: {student.grade_level || 'N/A'}-{student.section_name || 'A'}</span>
                    <span className="font-mono text-gray-500">|</span>
                    <span className="font-mono">PEN: {student.pen_number}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex-shrink-0 mb-2">
                  <img src={qrUrl} alt="QR Code" className="w-20 h-20 object-contain border border-gray-100 p-1" />
                </div>

                {/* Footer: Telugu Message */}
                <div className="w-full bg-gray-50 py-1 px-2 rounded text-center mt-auto">
                  <p className="text-[10px] font-bold text-blue-900 leading-tight">
                    మీ పరీక్ష ఫలితాలను చూడటానికి <br/> QR కోడ్‌ని స్కాన్ చేయండి
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Print Footer */}
      <div className="hidden print:block text-center text-[8px] text-gray-300 mt-4 fixed bottom-0 w-full left-0">
        Official Student Report Access Card • Generated by District Schools Portal
      </div>
    </div>
  );
};

export default QRCodePrintView;