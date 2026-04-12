import { ChevronLeft, ChevronRight, Clock, Star, CalendarIcon } from 'lucide-react';
import { readDataFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface CalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  recurring: string | null;
}

function loadEvents(): CalEvent[] {
  return readDataFile('events.json', [] as CalEvent[]);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const events = loadEvents();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  function getEventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => {
      if (e.date === dateStr) return true;
      if (e.recurring === 'daily') return true;
      if (e.recurring === 'weekly') {
        const eventDate = new Date(e.date);
        const currentDate = new Date(dateStr);
        return eventDate.getDay() === currentDate.getDay() && currentDate >= eventDate;
      }
      return false;
    });
  }

  const typeIcons: Record<string, string> = {
    cron: '⚡',
    scheduled: '📅',
    milestone: '⭐',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Calendar</h1>
        <p style={{ color: 'var(--muted)' }} className="text-sm">
          Scheduled tasks, cron jobs, and milestones.
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <span className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <ChevronLeft size={16} style={{ color: 'var(--muted)' }} />
            </span>
            <span className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="text-center text-xs py-2 font-medium"
              style={{ color: 'var(--muted)' }}
            >
              {d}
            </div>
          ))}

          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day === today;

            return (
              <div
                key={i}
                className="min-h-24 p-2 rounded-lg"
                style={{
                  background: isToday ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                  border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                {day && (
                  <>
                    <div
                      className="text-xs mb-1 font-medium"
                      style={{ color: isToday ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id + '-' + day}
                        className="text-xs mb-0.5 px-1.5 py-0.5 rounded truncate"
                        style={{
                          background:
                            evt.type === 'cron'
                              ? 'rgba(99,102,241,0.15)'
                              : evt.type === 'milestone'
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(34,197,94,0.15)',
                          color:
                            evt.type === 'cron'
                              ? 'var(--accent)'
                              : evt.type === 'milestone'
                              ? 'var(--warning)'
                              : 'var(--success)',
                        }}
                      >
                        {typeIcons[evt.type] || '📌'} {evt.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event List */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-4">All Events</h2>
        <div className="flex flex-col gap-2">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {evt.type === 'cron' ? (
                <Clock size={14} style={{ color: 'var(--accent)' }} />
              ) : evt.type === 'milestone' ? (
                <Star size={14} style={{ color: 'var(--warning)' }} />
              ) : (
                <CalendarIcon size={14} style={{ color: 'var(--success)' }} />
              )}
              <div className="flex-1">
                <div className="text-sm">{evt.title}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {evt.date} at {evt.time} {evt.recurring ? `· repeats ${evt.recurring}` : ''}
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background:
                    evt.type === 'cron'
                      ? 'rgba(99,102,241,0.1)'
                      : evt.type === 'milestone'
                      ? 'rgba(245,158,11,0.1)'
                      : 'rgba(34,197,94,0.1)',
                  color:
                    evt.type === 'cron'
                      ? 'var(--accent)'
                      : evt.type === 'milestone'
                      ? 'var(--warning)'
                      : 'var(--success)',
                }}
              >
                {evt.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
