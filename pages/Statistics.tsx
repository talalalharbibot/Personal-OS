
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TaskStatus, Task } from '../types';
import { ArrowRight, CheckCircle2, TrendingUp, Target, PieChart as PieChartIcon, Activity, Calendar, BarChart3, Clock, Table2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area, CartesianGrid, YAxis } from 'recharts';
import { 
    startOfDay, endOfDay, 
    startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, 
    startOfYear, endOfYear, 
    subDays, eachDayOfInterval, 
    eachMonthOfInterval, 
    format, isWithinInterval, 
    isSameDay, getHours, 
    eachHourOfInterval,
    isSameHour,
    isSameMonth
} from 'date-fns';
import { ar } from 'date-fns/locale';

type TimeRange = 'day' | 'week' | 'month' | '90days' | 'year';

export const Statistics: React.FC = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  // Fetch Data - Filter Deleted
  const tasks = useLiveQuery(() => db.tasks.filter(t => !t.deletedAt).toArray());

  // ----------------------------------------------------------------
  // 1. Date Range Logic
  // ----------------------------------------------------------------
  const dateLimits = useMemo(() => {
      const now = new Date();
      switch (timeRange) {
          case 'day':
              return { start: startOfDay(now), end: endOfDay(now) };
          case 'week':
              return { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) };
          case 'month':
              return { start: startOfMonth(now), end: endOfMonth(now) };
          case '90days':
              return { start: subDays(now, 90), end: endOfDay(now) };
          case 'year':
              return { start: startOfYear(now), end: endOfYear(now) };
          default:
              return { start: startOfWeek(now), end: endOfWeek(now) };
      }
  }, [timeRange]);

  // ----------------------------------------------------------------
  // 2. Data Filtering
  // ----------------------------------------------------------------
  const filteredTasks = useMemo(() => {
      if (!tasks) return [];
      return tasks.filter(t => {
          // Task belongs to this period if:
          // A. It was executed/scheduled in this period
          // B. OR It was completed in this period
          const dateToCheck = t.completedAt ? new Date(t.completedAt) : (t.executionDate ? new Date(t.executionDate) : null);
          
          if (!dateToCheck) return false;
          return isWithinInterval(dateToCheck, dateLimits);
      });
  }, [tasks, dateLimits]);

  // ----------------------------------------------------------------
  // 3. KPI Calculations
  // ----------------------------------------------------------------
  const kpiData = useMemo(() => {
      if (!filteredTasks) return null;

      const total = filteredTasks.length;
      const completed = filteredTasks.filter(t => t.status === TaskStatus.Completed).length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Calculate Focus Hours (Approximate: Duration of completed tasks)
      const totalMinutes = filteredTasks
        .filter(t => t.status === TaskStatus.Completed)
        .reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
      const focusHours = Math.round(totalMinutes / 60 * 10) / 10;

      return { total, completed, completionRate, focusHours };
  }, [filteredTasks]);

  // ----------------------------------------------------------------
  // 4. Trend Chart Logic (Dynamic Granularity)
  // ----------------------------------------------------------------
  const trendData = useMemo(() => {
      if (!filteredTasks) return [];

      let intervals: Date[] = [];
      let formatStr = 'd MMM'; // Default

      if (timeRange === 'day') {
          intervals = eachHourOfInterval(dateLimits);
          formatStr = 'HH:00';
      } else if (timeRange === 'year') {
          intervals = eachMonthOfInterval(dateLimits);
          formatStr = 'MMM';
      } else {
          // Week, Month, 90Days -> Daily breakdown
          // For 90 days, ensure we don't crash by limiting map if needed, but 90 points is fine for AreaChart
          intervals = eachDayOfInterval(dateLimits);
          formatStr = 'd MMM';
      }

      return intervals.map(datePoint => {
          let count = 0;
          if (timeRange === 'day') {
              // Group by Hour
              count = filteredTasks.filter(t => {
                  const d = t.completedAt ? new Date(t.completedAt) : (t.executionDate ? new Date(t.executionDate) : null);
                  return d && isSameDay(d, dateLimits.start) && getHours(d) === getHours(datePoint);
              }).length;
          } else if (timeRange === 'year') {
              // Group by Month
              count = filteredTasks.filter(t => {
                  const d = t.completedAt ? new Date(t.completedAt) : (t.executionDate ? new Date(t.executionDate) : null);
                  return d && d.getMonth() === datePoint.getMonth() && d.getFullYear() === datePoint.getFullYear();
              }).length;
          } else {
              // Group by Day
              count = filteredTasks.filter(t => {
                   const d = t.completedAt ? new Date(t.completedAt) : (t.executionDate ? new Date(t.executionDate) : null);
                   return d && isSameDay(d, datePoint);
              }).length;
          }

          return {
              name: format(datePoint, formatStr, { locale: ar }),
              value: count
          };
      });
  }, [filteredTasks, timeRange, dateLimits]);

  // ----------------------------------------------------------------
  // 5. Status & Type Distribution
  // ----------------------------------------------------------------
  const distributions = useMemo(() => {
      if (!filteredTasks) return { status: [], type: [] };

      // Status
      const active = filteredTasks.filter(t => [TaskStatus.Active, TaskStatus.Scheduled, TaskStatus.Focused].includes(t.status)).length;
      const completed = filteredTasks.filter(t => t.status === TaskStatus.Completed).length;
      const deferred = filteredTasks.filter(t => [TaskStatus.Deferred, TaskStatus.Stalled].includes(t.status)).length;
      
      const statusData = [
          { name: 'منجزة', value: completed, color: '#10b981' },
          { name: 'جارية', value: active, color: '#3b82f6' },
          { name: 'مؤجلة', value: deferred, color: '#f59e0b' },
      ].filter(d => d.value > 0);

      // Type
      const tasksCount = filteredTasks.filter(t => !t.type || t.type === 'task').length;
      const meetingsCount = filteredTasks.filter(t => t.type === 'meeting').length;
      const appointmentsCount = filteredTasks.filter(t => t.type === 'appointment').length;

      const typeData = [
          { name: 'مهام', count: tasksCount, fill: '#6366f1' },
          { name: 'اجتماعات', count: meetingsCount, fill: '#14b8a6' },
          { name: 'مواعيد', count: appointmentsCount, fill: '#a855f7' },
      ];

      return { status: statusData, type: typeData };
  }, [filteredTasks]);

  // ----------------------------------------------------------------
  // 6. Detailed Table Data Calculation
  // ----------------------------------------------------------------
  const tableData = useMemo(() => {
      if (!filteredTasks) return [];

      let intervals: Date[] = [];
      let formatStr = 'EEEE d MMM'; // Default for Week/Month (e.g., Sunday 12 Oct)

      if (timeRange === 'day') {
          intervals = eachHourOfInterval(dateLimits);
          // Special request: Add Day to Date in case of Day filter
          // Since it's hourly, we show Time + Date context or just Time if context is clear.
          // The prompt says "In case of Day filter, add Day to Date".
          formatStr = 'hh:mm a'; 
      } else if (timeRange === 'year') {
          intervals = eachMonthOfInterval(dateLimits);
          formatStr = 'MMMM yyyy';
      } else {
          intervals = eachDayOfInterval(dateLimits);
      }

      const rows = intervals.map(interval => {
          // Filter tasks belonging to this specific interval row
          const rowTasks = filteredTasks.filter(t => {
               const d = t.completedAt ? new Date(t.completedAt) : (t.executionDate ? new Date(t.executionDate) : null);
               if (!d) return false;

               if (timeRange === 'day') return isSameHour(d, interval);
               if (timeRange === 'year') return isSameMonth(d, interval) && d.getFullYear() === interval.getFullYear();
               return isSameDay(d, interval);
          });

          const total = rowTasks.length;
          if (total === 0) return null; // Skip empty rows to keep table clean (Optional: remove this if you want to show zeros)

          const completed = rowTasks.filter(t => t.status === TaskStatus.Completed).length;
          const remaining = total - completed;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          const tasksCount = rowTasks.filter(t => !t.type || t.type === 'task').length;
          const appointmentsCount = rowTasks.filter(t => t.type === 'appointment').length;
          const meetingsCount = rowTasks.filter(t => t.type === 'meeting').length;

          // Special Format for Day Filter Label to include Day Name as requested
          let label = format(interval, formatStr, { locale: ar });
          if (timeRange === 'day') {
              label = `${format(interval, 'hh:mm a', {locale: ar})} (${format(interval, 'EEEE', {locale: ar})})`;
          }

          return {
              date: interval,
              label,
              tasks: tasksCount,
              appointments: appointmentsCount,
              meetings: meetingsCount,
              total,
              completed,
              remaining,
              progress
          };
      }).filter(Boolean); // Remove nulls

      // Return chronological or reverse? Usually recent first is good for logs, chronological for charts.
      // Let's do Chronological as it matches the chart.
      return rows;
  }, [filteredTasks, timeRange, dateLimits]);


  // Helper for range buttons
  const RangeButton = ({ id, label }: { id: TimeRange, label: string }) => (
      <button
        onClick={() => setTimeRange(id)}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap
            ${timeRange === id 
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`
        }
      >
          {label}
      </button>
  );

  if (!tasks) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="h-full overflow-y-auto pb-24 p-6 max-w-lg mx-auto animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
          <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
              <ArrowRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">تحليل الأداء</h1>
      </div>

      {/* Time Range Selector */}
      <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex gap-1 mb-6 overflow-x-auto scrollbar-hide">
          <RangeButton id="day" label="يوم" />
          <RangeButton id="week" label="أسبوع" />
          <RangeButton id="month" label="شهر" />
          <RangeButton id="90days" label="90 يوم" />
          <RangeButton id="year" label="سنة" />
      </div>

      <div className="space-y-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
            {/* Completion Rate */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2 text-green-600 dark:text-green-400">
                    <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle2 size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">نسبة الإنجاز</span>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2">
                    {kpiData?.completionRate}%
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">
                    {kpiData?.completed} من أصل {kpiData?.total} مهام
                </p>
            </div>

            {/* Focus Hours */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <Clock size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">ساعات العمل</span>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2">
                    {kpiData?.focusHours}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">ساعة تقديرية</p>
            </div>

            {/* Total Activity */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 col-span-2">
                <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                        <Activity size={18} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">النشاط الكلي</span>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-2">
                    {kpiData?.total}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">عنصر في هذا الوقت</p>
            </div>
        </div>

        {/* 1. Trend Chart */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-primary-600" size={20} />
                    <h3 className="font-bold text-gray-800 dark:text-white">اتجاه النشاط</h3>
                </div>
                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500">
                    {timeRange === 'day' ? 'بالساعة' : timeRange === 'year' ? 'بالشهر' : 'باليوم'}
                </span>
            </div>
            
            <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#9ca3af', fontSize: 10}} 
                            interval="preserveStartEnd"
                            minTickGap={20}
                        />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                            cursor={{stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5'}}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorTrend)" 
                            activeDot={{ r: 6 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="grid gap-6">
            {/* 2. Status Distribution (Pie) */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon className="text-primary-600" size={20} />
                    <h3 className="font-bold text-gray-800 dark:text-white">توزيع الحالة</h3>
                </div>
                
                {distributions.status.length > 0 ? (
                    <div className="flex items-center">
                        <div className="h-48 w-1/2 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributions.status}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distributions.status.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-2">
                            {distributions.status.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: entry.color}} />
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{entry.name}</span>
                                    </div>
                                    <span className="text-xs font-medium text-gray-400">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                        لا توجد بيانات لهذه الفترة
                    </div>
                )}
            </div>

            {/* 3. Type Breakdown (Bar) */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="text-primary-600" size={20} />
                    <h3 className="font-bold text-gray-800 dark:text-white">حسب النوع</h3>
                </div>
                <div className="space-y-4">
                    {distributions.type.map((item) => (
                        <div key={item.name} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                                <span className="text-gray-800 dark:text-white">{item.count}</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{ 
                                        width: `${kpiData?.total ? (item.count / kpiData.total) * 100 : 0}%`,
                                        backgroundColor: item.fill 
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 4. Detailed History Table */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
                <Table2 className="text-primary-600" size={20} />
                <h3 className="font-bold text-gray-800 dark:text-white">سجل الأداء التفصيلي</h3>
            </div>
            
            <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm text-right">
                    <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/50 uppercase border-b dark:border-gray-700">
                        <tr>
                            <th className="px-3 py-3 rounded-tr-lg">التاريخ</th>
                            <th className="px-3 py-3 text-center">مهام</th>
                            <th className="px-3 py-3 text-center">مواعيد</th>
                            <th className="px-3 py-3 text-center">اجتماعات</th>
                            <th className="px-3 py-3 text-center bg-gray-100 dark:bg-gray-700/50">الكل</th>
                            <th className="px-3 py-3 text-center text-green-600">منجز</th>
                            <th className="px-3 py-3 text-center text-orange-500">متبقي</th>
                            <th className="px-3 py-3 rounded-tl-lg text-center">%</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {tableData.length > 0 ? tableData.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-3 py-4 font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs">
                                    {row!.label}
                                </td>
                                <td className="px-3 py-4 text-center text-gray-600 dark:text-gray-400">
                                    {row!.tasks > 0 ? row!.tasks : '-'}
                                </td>
                                <td className="px-3 py-4 text-center text-gray-600 dark:text-gray-400">
                                    {row!.appointments > 0 ? row!.appointments : '-'}
                                </td>
                                <td className="px-3 py-4 text-center text-gray-600 dark:text-gray-400">
                                    {row!.meetings > 0 ? row!.meetings : '-'}
                                </td>
                                <td className="px-3 py-4 text-center font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50">
                                    {row!.total}
                                </td>
                                <td className="px-3 py-4 text-center text-green-600 dark:text-green-400 font-bold">
                                    {row!.completed}
                                </td>
                                <td className="px-3 py-4 text-center text-orange-500 dark:text-orange-400">
                                    {row!.remaining > 0 ? row!.remaining : <CheckCircle2 size={14} className="mx-auto text-green-300" />}
                                </td>
                                <td className="px-3 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${row!.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                style={{ width: `${row!.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400">{row!.progress}%</span>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-xs">
                                    لا توجد بيانات متاحة لهذا النطاق الزمني
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  );
};
