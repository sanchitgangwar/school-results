import React, { useState, useEffect } from 'react';
import { Printer, Globe, School, User, FileText, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import './App.css';
import telanganaLogo from './assets/Telangana-LOGO.png';

// --- MOCK DATA ---
const MOCK_API_RESPONSE = {
  student: {
    id: "uuid-student-1",
    name: "Ravi Kumar",
    name_telugu: "రవి కుమార్",
    pen_number: "2023456789",
    class_name: "Grade 10 - A",
    parent_phone: "9876543210",
    dob: "2008-05-15",
    school: {
      name: "Zilla Parishad High School, Narayanpet",
      name_telugu: "జిల్లా పరిషత్ ఉన్నత పాఠశాల, నారాయణపేట",
      udise_code: "36145678901",
      district: "Narayanpet",
      address: "Main Road, Near Bus Stand",
      address_telugu: "ప్రధాన రహదారి, బస్ స్టాండ్ దగ్గర"
    }
  },
  results: [
    {
      exam_name: "Quarterly Examinations 2024",
      exam_name_telugu: "త్రైమాసిక పరీక్షలు 2024",
      exam_date: "2024-10-15",
      subjects: [
        { name: "Telugu", name_telugu: "తెలుగు", marks: 92, max: 100, grade: "A1" },
        { name: "Hindi", name_telugu: "హిందీ", marks: 88, max: 100, grade: "A2" },
        { name: "English", name_telugu: "ఆంగ్లం", marks: 85, max: 100, grade: "A2" },
        { name: "Mathematics", name_telugu: "గణితం", marks: 95, max: 100, grade: "A1" },
        { name: "Science", name_telugu: "సైన్స్", marks: 89, max: 100, grade: "A2" },
        { name: "Social Studies", name_telugu: "సాంఘిక శాస్త్రం", marks: 91, max: 100, grade: "A1" }
      ]
    },
    {
      exam_name: "Unit Test 1 2024",
      exam_name_telugu: "యూనిట్ టెస్ట్ 1 2024",
      exam_date: "2024-08-20",
      subjects: [
        { name: "Telugu", name_telugu: "తెలుగు", marks: 22, max: 25, grade: "A1" },
        { name: "Hindi", name_telugu: "హిందీ", marks: 20, max: 25, grade: "A2" },
        { name: "English", name_telugu: "ఆంగ్లం", marks: 19, max: 25, grade: "B1" },
        { name: "Mathematics", name_telugu: "గణితం", marks: 24, max: 25, grade: "A1" },
        { name: "Science", name_telugu: "సైన్స్", marks: 21, max: 25, grade: "A2" },
        { name: "Social Studies", name_telugu: "సాంఘిక శాస్త్రం", marks: 23, max: 25, grade: "A1" }
      ]
    }
  ]
};

// --- HELPER COMPONENT: SINGLE EXAM SECTION ---
const ExamSection = ({ result, isDefaultOpen, t }) => {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  // Calculate totals for this specific exam
  const totalMarks = result.subjects.reduce((acc, curr) => acc + curr.marks, 0);
  const totalMax = result.subjects.reduce((acc, curr) => acc + curr.max, 0);
  const percentage = totalMax > 0 ? ((totalMarks / totalMax) * 100).toFixed(1) : "0.0";

  return (
    <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm print:border-2 print:border-black print:shadow-none break-inside-avoid">
      {/* Header / Clickable Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex flex-col md:flex-row md:items-center justify-between p-5 transition-colors text-left
          ${isOpen ? 'bg-blue-50 text-blue-900' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
      >
        <div className="flex items-center gap-3 mb-2 md:mb-0">
           {isOpen ? <ChevronUp className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
           <div>
             <h3 className="font-bold text-lg">{t(result.exam_name, result.exam_name_telugu)}</h3>
             <span className="text-xs opacity-70">{t('Date', 'తేదీ')}: {result.exam_date}</span>
           </div>
        </div>
        
        {/* Summary Badge (Visible even when collapsed) */}
        <div className="flex items-center gap-4 pl-8 md:pl-0">
           <div className="text-right">
             <p className="text-xs uppercase tracking-wider opacity-60">{t('Percentage', 'శాతం')}</p>
             <p className="font-bold text-xl">{percentage}%</p>
           </div>
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="border-t border-gray-200">
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b border-gray-200 border-r">{t('Subject', 'విషయం')}</th>
                    <th className="px-6 py-4 border-b border-gray-200 border-r text-center">{t('Max Marks', 'గరిష్ట మార్కులు')}</th>
                    <th className="px-6 py-4 border-b border-gray-200 border-r text-center">{t('Marks Obtained', 'పొందిన మార్కులు')}</th>
                    <th className="px-6 py-4 border-b border-gray-200 text-center">{t('Grade', 'గ్రేడ్')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-800 border-r border-gray-100">
                        {t(sub.name, sub.name_telugu)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500 border-r border-gray-100">
                        {sub.max}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-blue-700 text-base border-r border-gray-100">
                        {sub.marks}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                          ${sub.grade.startsWith('A') ? 'bg-green-100 text-green-700' : 
                            sub.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' : 
                            'bg-yellow-100 text-yellow-700'}`}>
                          {sub.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-blue-50/30 border-t-2 border-gray-100">
                    <td className="px-6 py-4 font-bold text-gray-900 border-r border-gray-100">{t('Total', 'మొత్తం')}</td>
                    <td className="px-6 py-4 text-center border-r border-gray-100 text-gray-500">{totalMax}</td>
                    <td className="px-6 py-4 text-center text-lg font-bold text-blue-700 border-r border-gray-100">
                      {totalMarks}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-700">
                       {percentage}%
                    </td>
                  </tr>
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

const App = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [language, setLanguage] = useState('en');

  // // Inject Tailwind CSS dynamically
  // useEffect(() => {
  //   const script = document.createElement('script');
  //   script.src = "https://cdn.tailwindcss.com";
  //   script.async = true;
  //   document.head.appendChild(script);
  // }, []);

  // Simulate fetching data
  useEffect(() => {
    const fetchData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); 
        setData(MOCK_API_RESPONSE);
        setLoading(false);
      } catch (err) {
        setError("Unable to load results. Please check the link.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Get token from URL (assumes URL is http://domain.com/results/:token)
        const pathSegments = window.location.pathname.split('/');
        const token = pathSegments[pathSegments.length - 1]; 
        
        // 2. Call your new Node API
        const response = await fetch(`http://localhost:3000/api/public/student/${token}`);
        
        if (!response.ok) {
          throw new Error('Invalid Token or Student Not Found');
        }
        
        const result = await response.json();
        setData(result);
        setLoading(false);
      } catch (err) {
        setError("Unable to load results. Please check the link.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper to get text based on language
  const t = (en, te) => {
    return (language === 'te' && te) ? te : en;
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg border-l-4 border-red-500">
          <h3 className="text-xl font-bold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, results } = data;

  return (
    // FORCE LIGHT THEME
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans print:bg-white">
      
      {/* --- NAVBAR --- */}
      <nav className="bg-blue-700 text-white shadow-md print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {/*<School className="h-6 w-6" />*/}
            <img src={telanganaLogo} class="h-16 w-auto" />
            <span className="font-bold text-lg">District School Marks Portal</span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.print()}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded transition"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button 
              onClick={() => setLanguage(l => l === 'en' ? 'te' : 'en')}
              className="flex items-center space-x-1 bg-white text-blue-700 px-3 py-1.5 rounded font-medium hover:bg-blue-50 transition"
            >
              <Globe className="h-4 w-4" />
              <span>{language === 'en' ? 'తెలుగు' : 'English'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8 print:p-0">
        
        {/* REPORT CARD CONTAINER */}
        <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 print:shadow-none print:border-2 print:border-black print:rounded-none">
          
          {/* HEADER SECTION */}
          <div className="bg-blue-50 p-6 border-b border-blue-100 print:bg-white print:border-b-2 print:border-black">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-blue-900 print:text-black uppercase tracking-wide">
                  {t(student.school.name, student.school.name_telugu)}
                </h1>
                <p className="text-blue-700 print:text-gray-700 font-medium mt-1">
                  {t(student.school.address, student.school.address_telugu)}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded print:border print:border-gray-300">
                    UDISE: {student.school.udise_code}
                  </span>
                  <span>District: {student.school.district}</span>
                </div>
              </div>
              <div className="text-right hidden md:block print:block">
                 <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto ml-auto mb-2 print:border print:border-gray-300">
                   <School className="h-8 w-8 text-blue-600 print:text-black" />
                 </div>
                 <p className="text-xs text-gray-500 uppercase tracking-widest">Official Report</p>
              </div>
            </div>
          </div>

          {/* STUDENT DETAILS GRID */}
          <div className="p-6 print:p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {t('Student Details', 'విద్యార్థి వివరాలు')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div className="grid grid-cols-3 items-center">
                <span className="text-gray-500 font-medium col-span-1">{t('Student Name', 'విద్యార్థి పేరు')}:</span>
                <span className="font-bold text-gray-900 col-span-2 text-lg">
                  {t(student.name, student.name_telugu)}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="text-gray-500 font-medium col-span-1">{t('PEN Number', 'PEN సంఖ్య')}:</span>
                <span className="font-mono font-bold text-gray-900 col-span-2 bg-gray-50 p-1 rounded inline-block w-max print:bg-transparent print:p-0">
                  {student.pen_number}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="text-gray-500 font-medium col-span-1">{t('Class', 'తరగతి')}:</span>
                <span className="font-semibold text-gray-900 col-span-2">{student.class_name}</span>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="text-gray-500 font-medium col-span-1">{t('Parent Phone', 'తల్లిదండ్రుల ఫోన్')}:</span>
                <span className="font-mono text-gray-900 col-span-2">{student.parent_phone}</span>
              </div>
            </div>
          </div>

          {/* EXAM RESULTS SECTION (ITERATED) */}
          <div className="p-6 pt-2 print:p-4">
             <div className="flex justify-between items-end mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                {t('Exam Results', 'పరీక్ష ఫలితాలు')}
              </h2>
             </div>
             
             {/* Map through results */}
             <div>
                {results.map((result, idx) => (
                  <ExamSection 
                    key={idx} 
                    result={result} 
                    isDefaultOpen={idx === 0} // Expand only the first one
                    t={t}
                  />
                ))}
             </div>
          </div>

          {/* FOOTER */}
          <div className="bg-gray-50 p-6 border-t border-gray-200 text-center print:bg-white print:mt-8 print:border-t-0">
            <p className="text-sm text-gray-500 print:text-black">
              {t('This is a computer generated document.', 'ఇది కంప్యూటర్ ద్వారా రూపొందించబడిన పత్రం.')}
            </p>
            <div className="mt-4 flex justify-center gap-6 text-xs text-gray-400 print:hidden">
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Support: 1800-123-456
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> help@district-schools.in
              </div>
            </div>
            {/* Print Signature Line */}
            <div className="hidden print:flex justify-between mt-16 px-8">
               <div className="border-t border-black w-40 text-center text-sm pt-2">Principal Signature</div>
               <div className="border-t border-black w-40 text-center text-sm pt-2">Class Teacher Signature</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;