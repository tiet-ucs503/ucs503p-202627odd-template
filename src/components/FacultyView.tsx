import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { DEFAULT_FACULTY_DATA } from "@/src/lib/defaultData";
import { AlertCircle, CalendarRange, Clock, CheckCircle2, PieChart, CalendarX, Megaphone, Plus } from "lucide-react";

interface FacultyViewProps {
  facultyId: string;
}

export default function FacultyView({ facultyId }: FacultyViewProps) {
  const [data, setData] = useState<any>(DEFAULT_FACULTY_DATA);
  const [activeTab, setActiveTab] = useState<'routine' | 'constraints' | 'marketplace'>('routine');
  
  // Marketplace State
  const [marketplaceData, setMarketplaceData] = useState<any[]>([]);
  const [hasAnnounced, setHasAnnounced] = useState(false);

  const TIMETABLE_STORAGE_KEY = 'intelli_timetable_data';

  const loadData = () => {
    fetch(`/api/dashboard/faculty/${facultyId}`)
      .then(res => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(d => {
        if (d && Array.isArray(d.routine)) {
          setData(d);
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem(TIMETABLE_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.timetable)) {
              const facultyRoutine = parsed.timetable.filter((t: any) => t.facultyId === facultyId);
              setData((prev: any) => ({
                ...prev,
                routine: facultyRoutine.length > 0 ? facultyRoutine : (prev?.routine || DEFAULT_FACULTY_DATA.routine)
              }));
              return;
            }
          }
        } catch (e) {}
      });
  };

  const loadMarketplace = () => {
    fetch("/api/marketplace")
      .then(res => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(resData => {
        if (resData && Array.isArray(resData.opportunities)) {
          setMarketplaceData(resData.opportunities);
        }
      })
      .catch(() => {
        // Fallback default marketplace data
        setMarketplaceData([
          { id: "mk_1", subject: "DBMS", section: "CSE-A", day: "Tuesday", time: "11:00 - 12:00", room: "204" }
        ]);
      });
  };

  useEffect(() => {
    loadData();
    loadMarketplace();
    const interval = setInterval(() => {
      loadData();
      if (activeTab === 'marketplace') loadMarketplace();
    }, 5000);
    return () => clearInterval(interval);
  }, [facultyId, activeTab]);

  const handleCancel = (slotId: string) => {
    fetch("/api/cancel-class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId })
    })
      .then(loadData)
      .catch(() => {
        // Local state update in case of static deployment
        setData((prev: any) => ({
          ...prev,
          routine: (prev.routine || []).map((s: any) => s.id === slotId ? { ...s, status: "cancelled" } : s)
        }));
      });
  };

  const handleAccept = (opportunityId: string) => {
    fetch("/api/accept-opportunity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId })
    })
      .then(loadData)
      .catch(() => {
        setMarketplaceData(prev => prev.filter(o => o.id !== opportunityId));
      });
  };

  const announceAvailability = () => {
    setHasAnnounced(true);
    // In a real app this would POST to the backend to mark the slot as FREE for the recovery engine.
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Faculty Dashboard</h1>
      </div>

      <div className="flex space-x-2 border-b pb-4 mb-2 overflow-x-auto scrollbar-hide">
        <Button 
          variant={activeTab === 'routine' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('routine')}
          className={activeTab === 'routine' ? 'bg-slate-900' : 'text-slate-600'}
        >
          My Routine
        </Button>
        <Button 
          variant={activeTab === 'constraints' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('constraints')}
          className={activeTab === 'constraints' ? 'bg-slate-900' : 'text-slate-600'}
        >
          Leave & Availability
        </Button>
        <Button 
          variant={activeTab === 'marketplace' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('marketplace')}
          className={activeTab === 'marketplace' ? 'bg-slate-900' : 'text-slate-600'}
        >
          <Megaphone className="w-4 h-4 mr-2" />
          Free-Slot Marketplace
        </Button>
      </div>
      
      {data.workload && activeTab === 'routine' && (
        <Card className="bg-slate-900 text-white border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center justify-between">
              <div className="flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-indigo-400" />
                Workload Distribution
              </div>
              <Badge className="bg-indigo-500 text-white hover:bg-indigo-600 border-0">{data.workload.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center mt-2">
              <div>
                <div className="text-2xl font-bold text-white">{data.workload.teaching}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Teaching</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-300">{data.workload.tutorial}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Tutorial</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-300">{data.workload.labs}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Labs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-300">{data.workload.visiting}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Visiting</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-300">{data.workload.research}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Research</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-300">{data.workload.meetings}h</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-1">Meetings</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'routine' && (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Routine (Today)</CardTitle>
            <CardDescription>Manage your upcoming schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.routine.length === 0 && (
                <div className="text-sm text-slate-500">No scheduled classes found.</div>
              )}
              {data.routine.map((slot: any) => (
                <div key={slot.id} className={`rounded-md border p-3 flex justify-between items-center transition-colors ${slot.status === 'cancelled' ? 'bg-red-50 border-red-100 opacity-75' : slot.status === 'rescheduled' ? 'bg-green-50 border-green-100' : 'bg-white'}`}>
                  <div>
                    <div className="font-mono text-xs text-slate-500 mb-1">{slot.day} • {slot.time}</div>
                    <div className={`font-semibold ${slot.status === 'cancelled' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                      {slot.subject} / {slot.section}
                    </div>
                  </div>
                  <div>
                    {slot.status === 'planned' && (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(slot.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                        Cancel
                      </Button>
                    )}
                    {slot.status === 'cancelled' && (
                      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-0 shadow-none">Cancelled</Badge>
                    )}
                    {slot.status === 'rescheduled' && (
                      <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100 border-0 shadow-none">Rescheduled</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarRange className="mr-2 h-5 w-5" /> 
              Makeup Opportunities
            </CardTitle>
            <CardDescription>The Self-Healing Engine found these matches.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.opportunities.length > 0 ? (
              <div className="space-y-4">
                {data.opportunities.map((opp: any) => (
                  <div key={opp.id} className="rounded-xl border p-5 shadow-sm bg-white">
                    <div className="font-semibold text-lg text-slate-900">{opp.subject} / {opp.section}</div>
                    <div className="flex items-center text-sm text-slate-600 mt-2 bg-slate-50 px-3 py-1.5 rounded-md w-fit">
                      <Clock className="h-4 w-4 mr-2" />
                      {opp.day} • {opp.time}
                    </div>
                    <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md">
                      <div className="text-sm font-medium text-green-800 flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {opp.matchScore}% Match (Cross-Cancellation found)
                      </div>
                      <p className="text-xs text-green-700 mt-1">Students and room {opp.room} are both free.</p>
                    </div>
                    <div className="mt-4">
                      <Button size="sm" className="w-full bg-slate-900 hover:bg-slate-800" onClick={() => handleAccept(opp.id)}>
                        Accept Slot
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-lg border border-dashed">
                <AlertCircle className="h-8 w-8 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-900">No opportunities yet.</p>
                <p className="text-xs text-slate-500 mt-1">When students become free, matches will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'constraints' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Submit Leave Request</CardTitle>
              <CardDescription>Engine will attempt to reschedule all affected classes automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <input type="date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <input type="date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Academic Leave (Conference)</option>
                    <option>Casual Leave</option>
                    <option>Medical Leave</option>
                  </select>
                </div>
                <Button className="w-full bg-slate-900 hover:bg-slate-800">
                  <CalendarX className="w-4 h-4 mr-2" />
                  Submit Request & Trigger Rescheduling
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability Preferences</CardTitle>
              <CardDescription>Help the Auto-Scheduler allocate your workload optimally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <span className="font-medium text-sm">Preferred Time</span>
                <span className="text-sm text-slate-500">Morning (8 AM - 1 PM)</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <span className="font-medium text-sm">Max Consecutive Hours</span>
                <span className="text-sm text-slate-500">2 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                <span className="font-medium text-sm">Weekly Off</span>
                <span className="text-sm text-slate-500">Saturday</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'marketplace' && (
        <Card className="max-w-3xl mx-auto border-indigo-100">
          <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
            <CardTitle className="text-indigo-900 flex items-center">
              <Megaphone className="w-5 h-5 mr-2 text-indigo-600" />
              Free-Slot Marketplace
            </CardTitle>
            <CardDescription>Voluntarily announce your free time to help the university recover cancelled sessions.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {!hasAnnounced ? (
              <div className="space-y-4 bg-white">
                <p className="text-sm text-slate-600 mb-4">You currently have no announced free slots. Select a time block to make yourself available to the Recovery Engine.</p>
                <div className="flex space-x-3">
                  <select className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option>Thursday 11:00 AM - 12:00 PM</option>
                    <option>Friday 2:00 PM - 3:00 PM</option>
                  </select>
                  <Button onClick={announceAvailability} className="bg-indigo-600 hover:bg-indigo-700">
                    <Megaphone className="w-4 h-4 mr-2" /> Announce Availability
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-green-50 text-green-800 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                    <span className="font-medium text-sm">You are marked AVAILABLE for Thursday 11:00 AM - 12:00 PM</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setHasAnnounced(false)} className="h-8 text-green-700 hover:text-green-900 hover:bg-green-100">Cancel</Button>
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Suitable Opportunities Found</h3>
                  <div className="grid gap-3">
                    {marketplaceData.map(task => (
                      <div key={task.id} className="flex justify-between items-center p-4 border rounded-lg hover:border-indigo-200 transition-colors bg-white shadow-sm">
                        <div>
                          <div className="font-semibold text-slate-900">{task.title} <span className="text-slate-400 font-normal mx-2">—</span> {task.group}</div>
                          <div className="text-sm text-slate-500 mt-1">Type: {task.type}</div>
                        </div>
                        <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                          <Plus className="w-4 h-4 mr-1" /> Volunteer
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
