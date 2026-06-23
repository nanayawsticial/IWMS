'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { holidaysApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';

export default function HolidaysPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null); // Holds holiday to delete

  // Form states
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayType, setHolidayType] = useState('public');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch holidays for the current year
  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list({ year: String(year) }),
    enabled: !!user,
  });

  // Create holiday mutation
  const createHoliday = useMutation({
    mutationFn: (data: any) => holidaysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      addToast('Holiday Created', 'The public holiday has been added successfully.', 'success');
      setShowAddModal(false);
      setHolidayName('');
      setHolidayDate('');
      setHolidayType('public');
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.error || 'Failed to create public holiday';
      addToast('Error', errMsg, 'error');
    }
  });

  // Delete holiday mutation
  const deleteHoliday = useMutation({
    mutationFn: (id: string) => holidaysApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      addToast('Holiday Deleted', 'The public holiday has been removed successfully.', 'success');
      setShowDeleteModal(null);
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.error || 'Failed to delete public holiday';
      addToast('Error', errMsg, 'error');
    }
  });

  if (!user) return null;

  const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(user.role);

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Build Calendar Days
  const firstDayOfMonth = new Date(year, month, 1);
  let startDayOfWeek = firstDayOfMonth.getDay();
  // Shift Sunday (0) to index 6, Monday (1) to index 0
  if (startDayOfWeek === 0) startDayOfWeek = 6;
  else startDayOfWeek -= 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Previous month's padding days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month's padding days (fill up to 42 total slots)
  const remainingSlots = 42 - calendarDays.length;
  for (let i = 1; i <= remainingSlots; i++) {
    calendarDays.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;
    createHoliday.mutate({ name: holidayName, date: holidayDate, type: holidayType });
  };

  const handleDeleteSubmit = () => {
    if (showDeleteModal) {
      deleteHoliday.mutate(showDeleteModal.id);
    }
  };

  const handleCellClick = (date: Date) => {
    if (!isAdmin) return;
    const formatted = formatDateStr(date);
    const dayHolidays = getHolidaysForDate(date);
    if (dayHolidays.length === 0) {
      setHolidayDate(formatted);
      setShowAddModal(true);
    } else {
      setShowDeleteModal(dayHolidays[0]);
    }
  };

  const getHolidaysForDate = (date: Date) => {
    const dStr = formatDateStr(date);
    return holidays.filter((h: any) => h.date === dStr);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const todayStr = formatDateStr(new Date());

  return (
    <div className="page-content">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title text-2xl font-bold text-slate-100">Holiday Calendar</h1>
          <p className="page-subtitle text-slate-400 text-sm">View and manage public holidays for your organization</p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary-sm flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
            onClick={() => {
              setHolidayDate(formatDateStr(new Date()));
              setShowAddModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Public Holiday
          </button>
        )}
      </div>

      {/* Calendar Navigation & Info */}
      <div className="flex items-center justify-between mb-4 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition"
            aria-label="Previous Month"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="text-lg font-bold text-slate-100 min-w-[140px] text-center">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition"
            aria-label="Next Month"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: 0.7 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(to right, var(--purple), var(--blue))', display: 'inline-block' }} />
            Public Holiday
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: 0.7 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--text-3)', display: 'inline-block' }} />
            Work Day
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-slate-900/35 border border-slate-850/80 rounded-2xl overflow-hidden backdrop-blur-lg">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 700 }}>
            {/* Weekdays Header */}
            <div className="grid grid-cols-7 border-b border-slate-800/80 bg-slate-900/60 py-3 text-center text-xs font-semibold text-slate-400">
              {weekdayNames.map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-800/50 min-h-[500px]">
              {calendarDays.map((dayObj, index) => {
                const formatted = formatDateStr(dayObj.date);
                const isToday = formatted === todayStr;
                const dayHolidays = getHolidaysForDate(dayObj.date);

                return (
                  <div
                    key={index}
                    style={{
                      minHeight: 80,
                      verticalAlign: 'top',
                      padding: '6px 8px',
                      border: '0.5px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    className={`flex flex-col justify-between transition-colors relative ${
                      dayObj.isCurrentMonth ? 'bg-transparent text-slate-100' : 'bg-slate-950/20 text-slate-500'
                    } ${
                      isAdmin && dayObj.isCurrentMonth ? 'hover:bg-slate-800/30' : ''
                    }`}
                    onClick={() => handleCellClick(dayObj.date)}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-extrabold'
                            : ''
                        }`}
                      >
                        {dayObj.date.getDate()}
                      </span>
                    </div>

                    {/* Holiday band / details */}
                    <div className="mt-2 space-y-1">
                      {dayHolidays.map((holiday: any) => (
                        <div
                          key={holiday.id}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent trigger add holiday modal on click
                            setShowDeleteModal(holiday);
                          }}
                          className="px-2 py-1.5 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-indigo-950/80 to-violet-950/80 border border-indigo-700/50 text-indigo-300 hover:border-red-500/50 hover:text-red-400 cursor-pointer transition shadow-sm"
                          title={holiday.name}
                        >
                          <div className="truncate">{holiday.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: 8, textAlign: 'center' }}>
        Click any date to add a public holiday
      </p>

      {/* Add Holiday Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
              <h3 className="text-lg font-bold text-slate-100">Add Public Holiday</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-100 transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Holiday Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Christmas Day"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    required
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Holiday Type</label>
                  <select
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-indigo-500 focus:outline-none transition"
                  >
                    <option value="public">Public Holiday</option>
                    <option value="optional">Optional Holiday</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 transition text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHoliday.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition text-sm font-semibold flex items-center gap-1.5"
                >
                  {createHoliday.isPending ? 'Saving...' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Details Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
              <h3 className="text-lg font-bold text-slate-100">Holiday Details</h3>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="text-slate-400 hover:text-slate-100 transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Holiday Name</span>
                <span className="text-slate-100 text-base font-bold">{showDeleteModal.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                <span className="text-slate-200 text-sm">{new Date(showDeleteModal.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</span>
                <span className="text-slate-200 text-sm uppercase font-semibold">{showDeleteModal.type}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-between items-center">
              {isAdmin ? (
                <button
                  onClick={handleDeleteSubmit}
                  disabled={deleteHoliday.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition text-sm font-semibold"
                >
                  {deleteHoliday.isPending ? 'Deleting...' : 'Delete Holiday'}
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 transition text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
