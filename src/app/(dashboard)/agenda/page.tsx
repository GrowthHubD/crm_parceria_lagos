"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle, ExternalLink, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, getDaysInMonth, startOfMonth, getDay, isSameDay, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

interface KanbanTask {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  isCompleted: boolean;
  assigneeName: string | null;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  htmlLink?: string;
}

interface TeamUser {
  id: string;
  name: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-error/20 text-error border-l-2 border-error",
  high: "bg-warning/10 text-warning border-l-2 border-warning",
  medium: "bg-primary/10 text-primary border-l-2 border-primary",
  low: "bg-surface-2 text-muted border-l-2 border-border",
};

export default function AgendaPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (y: number, m: number, uid?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(y), month: String(m) });
      if (uid) params.set("userId", uid);
      const res = await fetch(`/api/agenda?${params}`);
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks);
        setGoogleEvents(d.googleEvents ?? []);
        setHasCalendar(d.hasCalendar);
        setTeamUsers(d.teamUsers ?? []);
        setViewingUserId(d.viewingUserId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(year, month);
  }, [year, month, fetchData]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1))); // 0=Sun
  const leadingBlanks = (firstDayOfWeek + 6) % 7; // Convert to Mon-first

  const getTasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasks.filter((t) => t.dueDate === dateStr);
  };

  const getGoogleEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return googleEvents.filter((e) => {
      const eDate = e.start.date ?? e.start.dateTime?.slice(0, 10);
      return eDate === dateStr;
    });
  };

  const selectedTasks = selectedDate ? getTasksForDay(selectedDate.getDate()) : [];
  const selectedEvents = selectedDate ? getGoogleEventsForDay(selectedDate.getDate()) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 text-foreground">Agenda</h1>
          <p className="text-muted mt-1">
            {hasCalendar ? "Tarefas + Google Calendar" : "Tarefas do Kanban"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {teamUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              <select
                value={viewingUserId}
                onChange={(e) => fetchData(year, month, e.target.value)}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          {!hasCalendar && (
            <Link
              href="/configuracoes"
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <Calendar className="w-4 h-4" /> Conectar Google Calendar
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar grid */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-foreground capitalize">
              {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground transition-colors cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted">{d}</div>
            ))}
          </div>

          {/* Loading overlay */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          {/* Day cells */}
          {!loading && (
            <div className="grid grid-cols-7">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-border/50 bg-surface-2/20" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = new Date(year, month - 1, day);
                const dayTasks = getTasksForDay(day);
                const dayEvents = getGoogleEventsForDay(day);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isTodayDay = isToday(date);
                const total = dayTasks.length + dayEvents.length;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "min-h-[80px] p-1.5 border-b border-r border-border/50 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-surface-2"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium mb-1",
                      isTodayDay ? "bg-primary text-white" : "text-foreground"
                    )}>
                      {day}
                    </div>
                    {total > 0 && (
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 2).map((t) => (
                          <div key={t.id} className={cn("text-[10px] px-1.5 py-0.5 rounded truncate", PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium)}>
                            {t.title}
                          </div>
                        ))}
                        {dayEvents.slice(0, total > 2 ? 1 : 2).map((e) => (
                          <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded truncate bg-[#4285F4]/15 text-[#4285F4] border-l-2 border-[#4285F4]">
                            {e.summary ?? "Evento"}
                          </div>
                        ))}
                        {total > 2 && (
                          <div className="text-[10px] text-muted px-1.5">+{total - 2}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDate
                ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
                : "Selecione um dia"}
            </h3>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[500px]">
            {/* Kanban tasks */}
            {selectedTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Tarefas</p>
                <div className="space-y-2">
                  {selectedTasks.map((t) => (
                    <div key={t.id} className={cn("p-3 rounded-lg flex items-start gap-2", PRIORITY_COLORS[t.priority] ?? "bg-surface-2 text-foreground")}>
                      {t.isCompleted
                        ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        : <Circle className="w-4 h-4 shrink-0 mt-0.5 opacity-50" />}
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium truncate", t.isCompleted && "line-through opacity-60")}>{t.title}</p>
                        {t.assigneeName && <p className="text-xs opacity-70 mt-0.5">{t.assigneeName}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Calendar events */}
            {selectedEvents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Google Calendar</p>
                <div className="space-y-2">
                  {selectedEvents.map((e) => (
                    <div key={e.id} className="p-3 rounded-lg bg-[#4285F4]/10 border-l-2 border-[#4285F4]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{e.summary ?? "Evento"}</p>
                        {e.htmlLink && (
                          <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-[#4285F4] hover:opacity-80 shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {e.start.dateTime && (
                        <p className="text-xs text-muted mt-1">
                          {format(parseISO(e.start.dateTime), "HH:mm")}
                          {e.end.dateTime && ` – ${format(parseISO(e.end.dateTime), "HH:mm")}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTasks.length === 0 && selectedEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-8 h-8 text-muted/30 mb-2" />
                <p className="text-sm text-muted">
                  {selectedDate ? "Sem eventos neste dia" : "Selecione um dia para ver os eventos"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
