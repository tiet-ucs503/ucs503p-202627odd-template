import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { AlertCircle, Clock, CalendarRange, Users, BookOpen } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { DEFAULT_STUDENT_DATA, DEFAULT_SETUP_DATA } from "@/src/lib/defaultData";
import { Button } from "@/src/components/ui/button";

interface StudentViewProps {
  sectionId: string;
}

export default function StudentView({ sectionId }: StudentViewProps) {
  const [data, setData] = useState<any>(DEFAULT_STUDENT_DATA);
  const [activeTab, setActiveTab] = useState<'routine' | 'polls'>('routine');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [availableSubgroups, setAvailableSubgroups] = useState<string[]>([]);

  const SETUP_STORAGE_KEY = 'intelli_college_setup_data';
  const TIMETABLE_STORAGE_KEY = 'intelli_timetable_data';

  // Mock polling data based on PDF page 27
  const [polls, setPolls] = useState([
    {
      id: "poll_1",
      subject: "DBMS Makeup",
      options: [
        { id: "opt_1", time: "Monday 3–4", votes: 12 },
        { id: "opt_2", time: "Tuesday 2–3", votes: 41 },
        { id: "opt_3", time: "Wednesday 4–5", votes: 8 }
      ],
      recommended: "opt_2",
      voted: false
    }
  ]);

  // Determine available subgroups for this section/batch
  useEffect(() => {
    try {
      const savedSetup = localStorage.getItem(SETUP_STORAGE_KEY);
      const setup = savedSetup ? JSON.parse(savedSetup) : DEFAULT_SETUP_DATA;
      const targetSec = (sectionId || "").trim().toLowerCase();
      
      const matchedBatch = setup?.batches?.find((b: any) => 
        (b.groupNumber || b.department || "").trim().toLowerCase() === targetSec
      );

      if (matchedBatch) {
        if (matchedBatch.subgroupNames && matchedBatch.subgroupNames.length > 0) {
          setAvailableSubgroups(matchedBatch.subgroupNames);
          if (!selectedSubgroup) setSelectedSubgroup(matchedBatch.subgroupNames[0]);
        } else {
          const count = Number(matchedBatch.subgroups) || Number(matchedBatch.sections) || 1;
          const gName = matchedBatch.groupNumber || matchedBatch.department || 'Batch';
          const names = Array.from({ length: count }, (_, i) => `${gName}-SG${i + 1}`);
          setAvailableSubgroups(names);
          if (!selectedSubgroup) setSelectedSubgroup(names[0]);
        }
      }
    } catch (e) {
      console.warn("Could not parse setup data for subgroups", e);
    }
  }, [sectionId]);

  const loadData = () => {
    fetch(`/api/dashboard/student/${encodeURIComponent(sectionId)}`)
      .then(async res => {
        if (res.ok) return res.json();
        throw new Error("Failed network fetch");
      })
      .then(d => {
        if (d && Array.isArray(d.routine)) {
          setData(d);
        }
      })
      .catch(() => {
        // Fallback to local storage timetable if offline
        try {
          const savedTT = localStorage.getItem(TIMETABLE_STORAGE_KEY);
          if (savedTT) {
            const parsed = JSON.parse(savedTT);
            if (parsed && Array.isArray(parsed.timetable)) {
              const target = (sectionId || "").trim().toLowerCase();
              const routine = parsed.timetable.filter((t: any) => {
                const sec = (t.section || "").trim().toLowerCase();
                const bch = (t.batch || "").trim().toLowerCase();
                return sec === target || bch === target || sec.startsWith(`${target}-`) || sec.startsWith(`${target}_`);
              });
              setData({ routine });
            }
          }
        } catch (e) {}
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [sectionId]);

  const handleVote = (pollId: string, optionId: string) => {
    setPolls(polls.map(poll => {
      if (poll.id === pollId && !poll.voted) {
        return {
          ...poll,
          voted: true,
          options: poll.options.map(opt => 
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          )
        };
      }
      return poll;
    }));
  };

  if (!data) return null;

  // Filter routine for active individual subgroup routing
  const rawRoutine: any[] = Array.isArray(data.routine) ? data.routine : [];
  const baseSectionLower = (sectionId || "").trim().toLowerCase();
  
  const displayedRoutine = rawRoutine.filter((slot: any) => {
    const secLower = (slot.section || "").trim().toLowerCase();
    const bchLower = (slot.batch || "").trim().toLowerCase();

    // If an individual subgroup routing is selected:
    if (selectedSubgroup) {
      const targetSubLower = selectedSubgroup.trim().toLowerCase();
      const isCommonBatchClass = secLower === baseSectionLower || slot.subgroup === 'all' || !slot.isSubgroup;
      const isThisSubgroupClass = secLower === targetSubLower || (slot.subgroup && slot.subgroup.trim().toLowerCase() === targetSubLower);
      return isCommonBatchClass || isThisSubgroupClass;
    }

    return true;
  });

  displayedRoutine.sort((a: any, b: any) => {
    const dayOrder: { [key: string]: number } = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
    const dayDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
    if (dayDiff !== 0) return dayDiff;
    return (a.time || '').localeCompare(b.time || '');
  });

  const activeAlerts = displayedRoutine.filter((s: any) => s.status === 'cancelled');
  const rescheduled = displayedRoutine.filter((s: any) => s.status === 'rescheduled');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Academic Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Class schedule & personalized subgroup routine for Batch <strong className="text-slate-800">{sectionId.toUpperCase()}</strong>
          </p>
        </div>

        {/* Individual Subgroup Selector */}
        {availableSubgroups.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-lg shadow-2xs">
            <span className="text-xs font-semibold text-slate-600 px-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              Routing:
            </span>
            <button
              onClick={() => setSelectedSubgroup('')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                !selectedSubgroup 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Batch
            </button>
            {availableSubgroups.map(sg => {
              const active = selectedSubgroup.trim().toLowerCase() === sg.trim().toLowerCase();
              return (
                <button
                  key={sg}
                  onClick={() => setSelectedSubgroup(sg)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    active 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sg} Routine
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex space-x-2 border-b pb-4 mb-2">
        <Button 
          variant={activeTab === 'routine' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('routine')}
          className={activeTab === 'routine' ? 'bg-slate-900' : 'text-slate-600'}
        >
          My Weekly Schedule
        </Button>
        <Button 
          variant={activeTab === 'polls' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('polls')}
          className={activeTab === 'polls' ? 'bg-slate-900' : 'text-slate-600 relative'}
        >
          Class Polling
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">1</span>
        </Button>
      </div>

      {selectedSubgroup && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <span>
              <strong>Active Individual Routine: {selectedSubgroup}</strong> — Showing all core theory lectures and exclusive lab sessions scheduled specifically for this subgroup.
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedSubgroup('')} 
            className="text-xs text-indigo-700 hover:text-indigo-900 h-6 px-2"
          >
            Show Full Batch
          </Button>
        </div>
      )}
      
      {activeTab === 'routine' && (
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>
                  {selectedSubgroup ? `${selectedSubgroup} Individual Schedule` : `Batch ${sectionId.toUpperCase()} Schedule`}
                </CardTitle>
                <CardDescription>
                  {displayedRoutine.length} classes scheduled across the week
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-slate-50 font-mono text-xs">
                {selectedSubgroup || sectionId.toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              {displayedRoutine.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-lg bg-slate-50/50">
                  <CalendarRange className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No classes found for this routine</p>
                  <p className="text-xs text-slate-500 mt-1">Please ask the coordinator to generate the timetable.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedRoutine.map((slot: any) => {
                    const isSub = slot.isSubgroup || (slot.section && slot.section.toLowerCase() !== baseSectionLower);
                    return (
                      <div 
                        key={slot.id} 
                        className={`flex justify-start items-center p-3.5 rounded-lg border transition-all ${
                          slot.status === 'cancelled' 
                            ? 'bg-red-50/80 border-red-200' 
                            : slot.status === 'rescheduled' 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="w-32 shrink-0">
                          <div className="font-semibold text-sm text-slate-800">{slot.day}</div>
                          <div className="font-mono text-xs text-slate-500 flex items-center mt-1">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" /> {slot.time}
                          </div>
                        </div>
                        <div className="flex-1 px-4 border-l border-slate-200 ml-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${slot.status === 'cancelled' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {slot.subject}
                            </span>
                            {isSub ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-medium text-[10px] px-1.5 py-0">
                                {slot.section}
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-[10px] px-1.5 py-0">
                                Batch Lecture
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                            <span>Room: <strong className="text-slate-700 font-medium">{slot.room || 'TBD'}</strong></span>
                            {slot.facultyId && (
                              <span>Faculty: <strong className="text-slate-700 font-medium">{slot.facultyId}</strong></span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {slot.status === 'cancelled' && <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-0 shadow-none">Cancelled</Badge>}
                          {slot.status === 'rescheduled' && <Badge className="bg-emerald-100 text-emerald-800 border-0 shadow-none">Rescheduled</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Live Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeAlerts.length === 0 && rescheduled.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No active alerts.</div>
              )}
              
              {activeAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-start bg-red-50 text-red-900 p-4 rounded-lg border border-red-100">
                  <AlertCircle className="mr-3 h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Session Cancelled</div>
                    <div className="text-xs mt-1">{alert.subject} scheduled for {alert.day} has been cancelled.</div>
                  </div>
                </div>
              ))}
              
              {rescheduled.map((res: any) => (
                <div key={res.id} className="flex items-start bg-emerald-50 text-emerald-900 p-4 rounded-lg border border-emerald-200">
                  <div className="h-5 w-5 mr-3 flex items-center justify-center rounded-full bg-emerald-200 text-emerald-700 font-bold text-xs mt-0.5">!</div>
                  <div>
                    <div className="font-semibold text-sm">Session Rescheduled</div>
                    <div className="text-xs mt-1">{res.subject} makeup session scheduled for {res.day} {res.time}.</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {activeTab === 'polls' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Class Representative Polling</CardTitle>
            <CardDescription>Vote on flexible makeup times proposed by the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {polls.map(poll => {
              const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
              
              return (
                <div key={poll.id} className="border rounded-lg p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">{poll.subject}</h3>
                    {poll.voted && <Badge variant="outline" className="bg-slate-100">Vote Recorded</Badge>}
                  </div>
                  
                  <div className="space-y-3">
                    {poll.options.map(opt => {
                      const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                      const isRecommended = poll.recommended === opt.id;
                      
                      return (
                        <div key={opt.id} className="relative">
                          <button 
                            className={`w-full text-left p-3 rounded-md border flex items-center justify-between transition-colors z-10 relative bg-transparent ${poll.voted ? 'cursor-default' : 'hover:border-indigo-300 cursor-pointer'} ${isRecommended && !poll.voted ? 'border-indigo-200' : 'border-slate-200'}`}
                            onClick={() => handleVote(poll.id, opt.id)}
                            disabled={poll.voted}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="font-medium text-sm">{opt.time}</span>
                              {isRecommended && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0 text-[10px] px-1.5 py-0">Recommended</Badge>}
                            </div>
                            {poll.voted && (
                              <span className="text-sm font-semibold text-slate-600">{opt.votes} votes ({percentage}%)</span>
                            )}
                          </button>
                          
                          {/* Progress bar background */}
                          {poll.voted && (
                            <div 
                              className="absolute top-0 left-0 h-full bg-slate-100 rounded-md -z-10 transition-all duration-1000 ease-out"
                              style={{ width: `${percentage}%` }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

