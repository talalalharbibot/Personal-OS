import { db } from '../db';
import { TaskStatus } from '../types';
import { subMinutes, differenceInMinutes, format, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import React from 'react';

// Sound URL (Gentle Bell)
const ALERT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const checkReminders = async () => {
    try {
        // Safety check: Don't run if DB is closed (e.g. during logout)
        if (!(db as any).isOpen()) return;

        // 1. Get Settings
        const soundEnabled = localStorage.getItem('notifications_sound') === 'true';
        const sysEnabled = localStorage.getItem('notifications_sys') === 'true';

        // 2. Query Tasks with Reminders that haven't been triggered yet
        // We filter roughly by date first to avoid scanning everything
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Fetch active/scheduled tasks for today or future
        const tasks = await db.tasks
            .where('status')
            .anyOf([TaskStatus.Active, TaskStatus.Scheduled, TaskStatus.Captured])
            .filter(t => {
                // Must have a scheduled time, a reminder set (>0), and not yet reminded
                return !!t.scheduledTime && !!t.reminderMinutes && t.reminderMinutes > 0 && !t.isReminded;
            })
            .toArray();

        const now = new Date();

        for (const task of tasks) {
            if (!task.scheduledTime || !task.reminderMinutes) continue;

            const scheduledTime = new Date(task.scheduledTime);
            const triggerTime = subMinutes(scheduledTime, task.reminderMinutes);

            // Check if NOW is greater than or equal to Trigger Time
            // We rely on !isReminded to prevent double firing.
            if (now >= triggerTime) {
                
                // 1. Mark as Reminded FIRST to prevent duplicate alerts
                await db.tasks.update(task.id!, { isReminded: true });

                // 2. Prepare Message Logic
                const diff = differenceInMinutes(scheduledTime, now);
                const isEventToday = isSameDay(scheduledTime, now);
                
                let timeMsg = '';
                if (diff > 0) {
                    timeMsg = `متبقي ${diff} دقيقة`;
                    // If not today, show Day and Date
                    if (!isEventToday) {
                        const dateStr = format(scheduledTime, 'EEEE، d MMMM', { locale: ar });
                        timeMsg += ` (يوم ${dateStr})`;
                    }
                } else {
                    timeMsg = 'حان الموعد الآن!';
                }

                const typeLabel = task.type === 'meeting' ? 'اجتماع' : task.type === 'appointment' ? 'موعد' : 'مهمة';
                const title = `تذكير: ${typeLabel} قادم`;
                const body = `${task.title}\n${timeMsg} (${format(scheduledTime, 'hh:mm a', { locale: ar })})`;

                // 3. Play Sound
                if (soundEnabled) {
                    try {
                        const audio = new Audio(ALERT_SOUND_URL);
                        audio.play().catch(e => console.error("Audio play failed (interaction required)", e));
                    } catch (e) {
                        console.error('Audio setup failed', e);
                    }
                }

                // 4. System Notification (Browser) with Click Action
                if (sysEnabled && 'Notification' in window && Notification.permission === 'granted') {
                    const notification = new Notification(title, {
                        body: body,
                        icon: '/favicon.ico', // Adjust path if needed
                        tag: `task-${task.id}`
                    });
                    
                    notification.onclick = () => {
                        window.focus(); // Focus the tab
                        window.location.hash = '#/focus'; // Navigate to focus/home
                        notification.close();
                    };
                }

                // 5. In-App Toast (Always show if app is open)
                toast((t) => React.createElement('div', {
                        onClick: () => {
                            toast.dismiss(t.id);
                            window.location.hash = `#/focus`; // Navigate to details/focus
                        },
                        className: "flex items-start gap-3 min-w-[300px] cursor-pointer",
                        dir: "rtl"
                    },
                    React.createElement('div', { className: "bg-primary-100 text-primary-600 p-2 rounded-full mt-1" },
                        React.createElement('svg', {
                            xmlns: "http://www.w3.org/2000/svg",
                            width: "20",
                            height: "20",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round"
                        },
                        React.createElement('path', { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" }),
                        React.createElement('path', { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0" })
                        )
                    ),
                    React.createElement('div', { className: "flex-1" },
                        React.createElement('h4', { className: "font-bold text-gray-900" }, title),
                        React.createElement('p', { className: "text-sm text-gray-600 mt-1 font-medium line-clamp-2" }, task.title),
                        React.createElement('p', { className: "text-xs text-primary-600 mt-1 font-bold bg-primary-50 inline-block px-2 py-0.5 rounded" }, timeMsg)
                    )
                ), {
                    duration: 8000,
                    position: 'top-center',
                    style: {
                        borderRadius: '16px',
                        background: '#fff',
                        color: '#333',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                        border: '1px solid rgba(0,0,0,0.05)'
                    },
                });
            }
        }
    } catch (e: any) {
        // Silently ignore DatabaseClosedError as it likely happens during page reload or auth change
        if (e.name !== 'DatabaseClosedError' && !e.message?.includes('DatabaseClosedError')) {
            console.error('Reminder Check Error:', e);
        }
    }
};