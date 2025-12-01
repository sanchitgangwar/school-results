import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface GradeDistributionData {
    subject: string;
    grade_a: number;
    grade_b: number;
    grade_c: number;
    grade_d: number;
    total: number;
    grade_a_pct: number;
    grade_b_pct: number;
    grade_c_pct: number;
    grade_d_pct: number;
}

interface PerformanceChartProps {
    data: GradeDistributionData[];
    xKey?: string;
    tickFormatter?: (value: string) => string;
    minimal?: boolean;
    onBarClick?: (item: any) => void;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data = [], xKey = 'subject', tickFormatter, minimal = false, onBarClick }) => {

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // payload order depends on the stack order
            // We want to show all grades
            const item = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-sm text-gray-700">
                    <p className="font-bold mb-2 text-gray-900">{label}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3cb819' }}></span>
                            <span className="font-medium">Grade A:</span>
                            <span>{item.grade_a} ({item.grade_a_pct}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFC44A' }}></span>
                            <span className="font-medium">Grade B:</span>
                            <span>{item.grade_b} ({item.grade_b_pct}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E8793D' }}></span>
                            <span className="font-medium">Grade C:</span>
                            <span>{item.grade_c} ({item.grade_c_pct}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#B8193C' }}></span>
                            <span className="font-medium">Grade D:</span>
                            <span>{item.grade_d} ({item.grade_d_pct}%)</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-100 font-semibold text-gray-900">
                            Total Students: {item.total}
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const safeData = Array.isArray(data) ? data : [];
    const sortedData = [...safeData].sort((a, b) => b.grade_d_pct - a.grade_d_pct);
    const chartHeight = Math.max(384, sortedData.length * 40);

    const handleBarClick = (data: any) => {
        if (onBarClick && data) {
            onBarClick(data);
        }
    };

    return (
        <div className={`w-full ${minimal ? '' : 'bg-white p-4 rounded-lg shadow border border-gray-200'}`} style={{ height: chartHeight }}>
            {!minimal && <h3 className="text-gray-800 text-lg font-semibold mb-4">Subject Performance Distribution</h3>}
            <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={sortedData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis
                        type="number"
                        stroke="#6b7280"
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        unit="%"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                    />
                    <YAxis
                        dataKey={xKey}
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickFormatter={tickFormatter}
                        width={150}
                        interval={0}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ top: 0, fontSize: '12px' }} />

                    {/* Stacked Bars for Grades */}
                    <Bar
                        dataKey="grade_d_pct"
                        name="D (0-35%)"
                        stackId="a"
                        fill="#B8193C"
                        barSize={20}
                        isAnimationActive={false}
                        onClick={handleBarClick}
                        cursor="pointer"
                    />
                    <Bar
                        dataKey="grade_c_pct"
                        name="C (35-60%)"
                        stackId="a"
                        fill="#E8793D"
                        barSize={20}
                        isAnimationActive={false}
                        onClick={handleBarClick}
                        cursor="pointer"
                    />
                    <Bar
                        dataKey="grade_b_pct"
                        name="B (60-80%)"
                        stackId="a"
                        fill="#FFC44A"
                        barSize={20}
                        isAnimationActive={false}
                        onClick={handleBarClick}
                        cursor="pointer"
                    />
                    <Bar
                        dataKey="grade_a_pct"
                        name="A (80-100%)"
                        stackId="a"
                        fill="#3cb819"
                        barSize={20}
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                        onClick={handleBarClick}
                        cursor="pointer"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PerformanceChart;
