import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import PerformanceChart from './PerformanceChart';
import DrillDownList from './DrillDownList';
import SubjectBreakdown from './SubjectBreakdown';

const getGradeColor = (grade: string) => {
    switch (grade) {
        case 'A': return 'bg-green-100 text-green-800 hover:bg-green-200';
        case 'B': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
        case 'C': return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
        case 'D': return 'bg-red-100 text-red-800 hover:bg-red-200';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const calculateGrade = (obtained: number, max: number) => {
    if (!max) return 'F'; // Should not happen
    const pct = (obtained / max) * 100;
    if (pct >= 80) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 35) return 'C';
    return 'D';
};

const StudentMarksTable = ({ data }: { data: any[] }) => {
    const pivotData = useMemo(() => {
        const map: Record<string, any> = {};
        const subjects = new Set<string>();
        data.forEach(item => {
            if (!map[item.student_name]) map[item.student_name] = { name: item.student_name };
            map[item.student_name][item.subject] = item;
            subjects.add(item.subject);
        });
        return { rows: Object.values(map).sort((a: any, b: any) => a.name.localeCompare(b.name)), subjects: Array.from(subjects).sort() };
    }, [data]);

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <h3 className="p-4 text-gray-800 text-lg font-semibold border-b border-gray-200">Student Marks</h3>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Student Name</th>
                        {pivotData.subjects.map(sub => <th key={sub} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{sub}</th>)}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {pivotData.rows.map((row: any) => (
                        <tr key={row.name}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">{row.name}</td>
                            {pivotData.subjects.map((sub: string) => {
                                const cell = row[sub];
                                const grade = cell ? calculateGrade(Number(cell.marks_obtained), Number(cell.max_marks)) : undefined;
                                return (
                                    <td key={sub} className={`px-6 py-4 whitespace-nowrap text-center text-sm font-semibold cursor-default transition-colors ${getGradeColor(grade || '')}`}>
                                        {cell ? cell.marks_obtained : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
interface DashboardProps {
    user: any;
}

const AnalyticsDashboard: React.FC<DashboardProps> = ({ user }) => {
    const [loading, setLoading] = useState(true);
    const [exams, setExams] = useState<any[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [viewLevel, setViewLevel] = useState<'root' | 'district' | 'mandal' | 'school'>('root');
    const [selectedIds, setSelectedIds] = useState<{ districtId: number | null, mandalId: number | null, schoolId: number | null }>({
        districtId: null,
        mandalId: null,
        schoolId: null
    });
    const [selectedNames, setSelectedNames] = useState<{ districtName: string | null, mandalName: string | null, schoolName: string | null }>({
        districtName: null,
        mandalName: null,
        schoolName: null
    });


    const [entityChartData, setEntityChartData] = useState([]);
    const [studentMarksData, setStudentMarksData] = useState<any[]>([]);
    const [drillDownData, setDrillDownData] = useState([]);
    const [stats, setStats] = useState({
        avg: 0,
        pass: 0,
        gradeA: 0,
        gradeB: 0,
        gradeC: 0,
        gradeD: 0,
        schools: 0,
        students: 0,
        exams: 0
    });

    // Initial Scope Setup based on User Role
    useEffect(() => {
        if (user.role === 'school_admin') {
            setViewLevel('school');
            setSelectedIds({ districtId: user.district_id, mandalId: user.mandal_id, schoolId: user.school_id });
            setSelectedNames({
                districtName: user.district_name || null,
                mandalName: user.mandal_name || null,
                schoolName: user.school_name || null
            });
        } else if (user.role === 'meo') {
            setViewLevel('mandal');
            setSelectedIds({ districtId: user.district_id, mandalId: user.mandal_id, schoolId: null });
            setSelectedNames({
                districtName: user.district_name || null,
                mandalName: user.mandal_name || null,
                schoolName: null
            });
        } else if (user.role === 'deo') {
            setViewLevel('district');
            setSelectedIds({ districtId: user.district_id, mandalId: null, schoolId: null });
            setSelectedNames({
                districtName: user.district_name || null,
                mandalName: null,
                schoolName: null
            });
        }
    }, [user]);

    // Fetch Exams
    useEffect(() => {
        const fetchExams = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/exams`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setExams(data);
                    // Default to latest exam (first one due to DESC order)
                    if (data.length > 0) {
                        setSelectedExamId(String(data[0].id));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch exams", err);
            }
        };
        fetchExams();
    }, []);

    const fetchData = useCallback(async () => {
        if (!selectedExamId) return; // Wait for exam selection

        try {
            setLoading(true);
            const token = localStorage.getItem('authToken');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Construct Query Params
            const params = new URLSearchParams();
            params.append('exam_id', selectedExamId);
            if (selectedIds.districtId) params.append('district_id', String(selectedIds.districtId));
            if (selectedIds.mandalId) params.append('mandal_id', String(selectedIds.mandalId));
            if (selectedIds.schoolId) params.append('school_id', String(selectedIds.schoolId));

            // 1. Fetch Stats (Schools, Students, Exams)
            const statsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/stats?${params.toString()}`, { headers });
            const statsJson = await statsRes.json();

            // 2. Fetch Entity Performance Data (New)
            const entityParams = new URLSearchParams(params);
            entityParams.append('level', viewLevel);
            const entityRes = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/entity-performance?${entityParams.toString()}`, { headers });
            const entityJson = await entityRes.json();
            console.log('Entity Performance Data:', entityJson);
            setEntityChartData(Array.isArray(entityJson) ? entityJson : []);

            // 3. Fetch Drill Down Data
            const drillParams = new URLSearchParams();
            drillParams.append('level', viewLevel);
            drillParams.append('exam_id', selectedExamId);
            // Append the correct parent_id based on current viewLevel
            if (viewLevel === 'district' && selectedIds.districtId) {
                drillParams.append('parent_id', String(selectedIds.districtId));
            } else if (viewLevel === 'mandal' && selectedIds.mandalId) {
                drillParams.append('parent_id', String(selectedIds.mandalId));
            } else if (viewLevel === 'school' && selectedIds.schoolId) {
                drillParams.append('parent_id', String(selectedIds.schoolId));
            }

            const drillRes = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/drill-down?${drillParams.toString()}`, { headers });
            const drillJson = await drillRes.json();

            if (Array.isArray(drillJson)) {
                setDrillDownData(drillJson);
            } else {
                console.error("Invalid drill-down data format:", drillJson);
                setDrillDownData([]);
            }



            // 5. Fetch Student Marks (New) & Calculate Stats
            let avg = 0, pass = 0;
            let gradeCounts = { A: 0, B: 0, C: 0, D: 0 };

            if (viewLevel === 'school' && selectedIds.schoolId) {
                const marksRes = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/student-marks?school_id=${selectedIds.schoolId}`, { headers });
                const marksJson = await marksRes.json();
                const safeMarks = Array.isArray(marksJson) ? marksJson : [];
                setStudentMarksData(safeMarks);

                // Calculate Stats from Marks
                const studentMap: Record<string, { total: number, count: number, passed: boolean, grade: string }> = {};
                safeMarks.forEach((m: any) => {
                    if (!studentMap[m.student_name]) studentMap[m.student_name] = { total: 0, count: 0, passed: true, grade: 'D' };
                    const pct = (Number(m.marks_obtained) / Number(m.max_marks)) * 100;
                    studentMap[m.student_name].total += pct;
                    studentMap[m.student_name].count += 1;
                    if (pct < 35) studentMap[m.student_name].passed = false;
                });

                const students = Object.values(studentMap);

                if (students.length > 0) {
                    const totalAvg = students.reduce((acc, s) => {
                        const avgPct = s.total / s.count;
                        if (avgPct >= 80) gradeCounts.A++;
                        else if (avgPct >= 60) gradeCounts.B++;
                        else if (avgPct >= 35) gradeCounts.C++;
                        else gradeCounts.D++;
                        return acc + avgPct;
                    }, 0) / students.length;

                    const totalPass = (students.filter(s => s.passed).length / students.length) * 100;
                    avg = parseFloat(totalAvg.toFixed(1));
                    pass = parseFloat(totalPass.toFixed(1));
                }

            } else {
                setStudentMarksData([]);

                // Calculate Stats from Drill Down Data
                if (drillJson.length > 0) {
                    const totalAvg = drillJson.reduce((acc: number, curr: any) => acc + Number(curr.avg_score), 0) / drillJson.length;
                    const totalPass = drillJson.reduce((acc: number, curr: any) => acc + (Number(curr.pass_percentage) || 0), 0) / drillJson.length;
                    avg = parseFloat(totalAvg.toFixed(1));
                    pass = parseFloat(totalPass.toFixed(1));
                }
            }

            // Update Stats (Merge API stats with calculated averages)
            setStats({
                avg: avg || Number(statsJson.avg_score) || 0,
                pass: pass || Number(statsJson.pass_percentage) || 0,
                gradeA: (viewLevel === 'school' && selectedIds.schoolId) ? gradeCounts?.A : (Number(statsJson.grade_a_students) || 0),
                gradeB: (viewLevel === 'school' && selectedIds.schoolId) ? gradeCounts?.B : (Number(statsJson.grade_b_students) || 0),
                gradeC: (viewLevel === 'school' && selectedIds.schoolId) ? gradeCounts?.C : (Number(statsJson.grade_c_students) || 0),
                gradeD: (viewLevel === 'school' && selectedIds.schoolId) ? gradeCounts?.D : (Number(statsJson.grade_d_students) || 0),
                schools: Number(statsJson.total_schools) || 0,
                students: Number(statsJson.total_students) || 0,
                exams: Number(statsJson.total_exams) || 0
            });

        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            setLoading(false);
        }
    }, [viewLevel, selectedIds, selectedExamId]);

    useEffect(() => {
        if (selectedExamId) {
            fetchData();
        }
    }, [fetchData, selectedExamId]);

    const handleDrillDown = (item: any) => {
        if (viewLevel === 'root') {
            setViewLevel('district');
            setSelectedIds(prev => ({ ...prev, districtId: item.id }));
            setSelectedNames(prev => ({ ...prev, districtName: item.name }));
        } else if (viewLevel === 'district') {
            setViewLevel('mandal');
            setSelectedIds(prev => ({ ...prev, mandalId: item.id }));
            setSelectedNames(prev => ({ ...prev, mandalName: item.name }));
        } else if (viewLevel === 'mandal') {
            setViewLevel('school');
            setSelectedIds(prev => ({ ...prev, schoolId: item.id }));
            setSelectedNames(prev => ({ ...prev, schoolName: item.name }));
        } else {
            // Student Click - Maybe open modal?
            alert(`Student Report for ${item.name} (Coming Soon)`);
        }
    };

    const handleBreadcrumb = (level: 'root' | 'district' | 'mandal' | 'school') => {
        // Prevent going up if role restricts it
        if (user.role === 'school_admin' && level !== 'school') return;
        if (user.role === 'meo' && (level === 'root' || level === 'district')) return;
        if (user.role === 'deo' && level === 'root') return;

        setViewLevel(level);
        if (level === 'root') {
            setSelectedIds({ districtId: null, mandalId: null, schoolId: null });
            setSelectedNames({ districtName: null, mandalName: null, schoolName: null });
        }
        if (level === 'district') {
            setSelectedIds(prev => ({ ...prev, mandalId: null, schoolId: null }));
            setSelectedNames(prev => ({ ...prev, mandalName: null, schoolName: null }));
        }
        if (level === 'mandal') {
            setSelectedIds(prev => ({ ...prev, schoolId: null }));
            setSelectedNames(prev => ({ ...prev, schoolName: null }));
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col gap-2">
                <nav className="flex items-center text-sm text-gray-500">
                    <button
                        onClick={() => handleBreadcrumb('root')}
                        disabled={user.role !== 'admin'}
                        className={`flex items-center ${viewLevel === 'root' ? 'font-bold text-blue-800' : ''} ${user.role === 'admin' ? 'hover:text-blue-600 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                    >
                        <Home className="h-4 w-4 mr-1" /> Districts
                    </button>
                    {selectedIds.districtId && (
                        <>
                            <ChevronRight className="h-4 w-4 mx-1" />
                            <button
                                onClick={() => handleBreadcrumb('district')}
                                disabled={user.role === 'meo' || user.role === 'school_admin'}
                                className={`${viewLevel === 'district' ? 'font-bold text-blue-800' : ''} ${user.role !== 'meo' && user.role !== 'school_admin' ? 'hover:text-blue-600 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                            >
                                {selectedNames.districtName || 'District View'}
                            </button>
                        </>
                    )}
                    {selectedIds.mandalId && (
                        <>
                            <ChevronRight className="h-4 w-4 mx-1" />
                            <button
                                onClick={() => handleBreadcrumb('mandal')}
                                disabled={user.role === 'school_admin'}
                                className={`${viewLevel === 'mandal' ? 'font-bold text-blue-800' : ''} ${user.role !== 'school_admin' ? 'hover:text-blue-600 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                            >
                                {selectedNames.mandalName || 'Mandal View'}
                            </button>
                        </>
                    )}
                    {selectedIds.schoolId && (
                        <>
                            <ChevronRight className="h-4 w-4 mx-1" />
                            <span className="font-bold text-blue-800">{selectedNames.schoolName || 'School View'}</span>
                        </>
                    )}
                </nav>
            </div>

            <div className="flex flex-col gap-6">

                {/* STATS Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">STATS</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded bg-orange-50 border-l-4 border-orange-500">
                            <p className="text-sm text-gray-600">Total Schools</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.schools}</p>
                        </div>
                        <div className="p-4 rounded bg-teal-50 border-l-4 border-teal-500">
                            <p className="text-sm text-gray-600">Total Students</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.students}</p>
                        </div>
                        <div className="p-4 rounded bg-indigo-50 border-l-4 border-indigo-500">
                            <p className="text-sm text-gray-600">Tests Conducted</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.exams}</p>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-200" />

                {/* Test Selection */}
                <div className="flex justify-end">
                    <div className="flex items-center gap-4">
                        <label htmlFor="exam-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Test:</label>
                        <select
                            id="exam-select"
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                        >
                            {exams.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* PERFORMANCE Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">PERFORMANCE</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded bg-blue-50 border-l-4 border-blue-500">
                            <p className="text-sm text-gray-600">Average Score</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.avg}%</p>
                        </div>
                        <div className="p-4 rounded bg-green-50 border-l-4 border-green-500">
                            <p className="text-sm text-gray-600">Pass Percentage</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.pass}%</p>
                        </div>
                        <div className="p-4 rounded bg-purple-50 border-l-4 border-purple-500">
                            <p className="text-sm text-gray-600 mb-2">Grade Distribution</p>
                            <div className="space-y-1">
                                {[
                                    { grade: 'A', count: stats.gradeA, color: 'text-green-700' },
                                    { grade: 'B', count: stats.gradeB, color: 'text-yellow-700' },
                                    { grade: 'C', count: stats.gradeC, color: 'text-orange-700' },
                                    { grade: 'D', count: stats.gradeD, color: 'text-red-700' }
                                ].map(item => (
                                    <div key={item.grade} className="flex justify-between text-xs">
                                        <span className={`font-semibold ${item.color}`}>Grade {item.grade}</span>
                                        <span className="text-gray-700 font-medium">{item.count} <span className="text-gray-500">({stats.students ? Math.round((item.count / stats.students) * 100) : 0}%)</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Main Content Grid */}
            <div className={viewLevel === 'school' ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}>
                {/* Left: Performance Chart or Student Marks Table */}
                <div className={viewLevel === 'school' ? "w-full space-y-6" : "lg:col-span-2 space-y-6"}>
                    {loading ? (
                        <div className="h-96 flex items-center justify-center bg-gray-100 rounded">Loading Chart...</div>
                    ) : (
                        <>
                            {viewLevel === 'school' ? (
                                <StudentMarksTable data={studentMarksData} />
                            ) : (
                                <>
                                    {/* Entity Performance Chart (New) */}
                                    {entityChartData.length > 0 && (
                                        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                            <h3 className="text-gray-800 text-lg font-semibold mb-4">
                                                {viewLevel === 'root' ? 'District Performance Distribution' :
                                                    viewLevel === 'district' ? 'Mandal Performance Distribution' :
                                                        viewLevel === 'mandal' ? 'School Performance Distribution' : ''}
                                            </h3>
                                            <PerformanceChart
                                                data={entityChartData}
                                                xKey="name"
                                                minimal={true}
                                                onBarClick={handleDrillDown}
                                            />
                                        </div>
                                    )}


                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Right: Drill Down List (Hidden for school view) */}
                {viewLevel !== 'school' && (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="h-96 flex items-center justify-center bg-gray-100 rounded">Loading List...</div>
                        ) : (
                            /* Drill Down List */
                            <DrillDownList
                                items={drillDownData}
                                level={
                                    viewLevel === 'root' ? 'district' :
                                        viewLevel === 'district' ? 'mandal' :
                                            viewLevel === 'mandal' ? 'school' : 'student'
                                }
                                onItemClick={handleDrillDown}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Subject Breakdown Heatmap (Full Width) */}
            {!loading && (
                <SubjectBreakdown
                    viewLevel={viewLevel}
                    selectedId={
                        viewLevel === 'root' ? '' :
                            viewLevel === 'district' ? String(selectedIds.districtId || '') :
                                viewLevel === 'mandal' ? String(selectedIds.mandalId || '') :
                                    String(selectedIds.schoolId || '')
                    }
                />
            )}
        </div>
    );
};

export default AnalyticsDashboard;
