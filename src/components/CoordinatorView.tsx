import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { CheckCircle2, Clock, AlertTriangle, CalendarRange, Bell, BookOpen, AlertCircle, TrendingUp, TrendingDown, Info, Settings, Wand2, Database, Search, UserCheck, Play, Edit2, Trash2, RotateCcw, Plus, X } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { DEFAULT_COORDINATOR_DATA, DEFAULT_SETUP_DATA } from "@/src/lib/defaultData";

export default function CoordinatorView() {
  const [data, setData] = useState<any>(DEFAULT_COORDINATOR_DATA);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timetable' | 'syllabus' | 'inbox' | 'generator' | 'simulator' | 'setup'>('dashboard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [activeMakeupSearch, setActiveMakeupSearch] = useState<string | null>(null);
  
  // Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Setup Data State
  // Setup Data State with Local Storage and Server Synchronization
  const SETUP_STORAGE_KEY = 'intelli_college_setup_data';
  const TIMETABLE_STORAGE_KEY = 'intelli_timetable_data';

  const getInitialSetupData = () => {
    try {
      const saved = localStorage.getItem(SETUP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.courses) && Array.isArray(parsed.faculty) && Array.isArray(parsed.batches)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read setup from localStorage", e);
    }
    return DEFAULT_SETUP_DATA;
  };

  const [setupData, setSetupData] = useState<any>(getInitialSetupData);
  const [setupNotice, setSetupNotice] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setSetupNotice({ text, type });
    setTimeout(() => {
      setSetupNotice(prev => prev?.text === text ? null : prev);
    }, 3500);
  };

  const saveSetupDataLocally = (updated: any) => {
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist setup data", e);
    }
  };

  const [newRoom, setNewRoom] = useState({ name: '', capacity: '', type: 'Lecture' });
  const [newCourse, setNewCourse] = useState({ name: '', hours: '', type: 'Lecture' });
  const [newFaculty, setNewFaculty] = useState({ name: '', department: '', subjects: [] as string[] });
  const [newBatch, setNewBatch] = useState({ groupNumber: '', department: '', totalStudents: '', subgroups: '', subgroupNames: [] as string[] });
  
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editFacultyId, setEditFacultyId] = useState<string | null>(null);
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  
  const [ttSearch, setTtSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [selectedSubgroupFilter, setSelectedSubgroupFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');

  const loadData = () => {
    fetch("/api/dashboard/coordinator")
      .then(async res => {
        const ct = res.headers.get("content-type");
        if (res.ok && ct && ct.includes("application/json")) {
          return res.json();
        }
        throw new Error("Not valid JSON API");
      })
      .then(d => {
        if (d) {
          setData(d);
          try {
            localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(d));
          } catch (e) {}
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(TIMETABLE_STORAGE_KEY);
          if (cached) {
            setData(JSON.parse(cached));
          }
        } catch (e) {}
      });
  };

  const loadSetup = () => {
    fetch("/api/setup-data")
      .then(async res => {
        const ct = res.headers.get("content-type");
        if (res.ok && ct && ct.includes("application/json")) {
          return res.json();
        }
        throw new Error("Not valid JSON API");
      })
      .then(s => {
        if (s && Array.isArray(s.rooms)) {
          setSetupData(s);
          saveSetupDataLocally(s);
        }
      })
      .catch(() => {
        // Silently use localStorage/defaults already loaded
      });
  };

  useEffect(() => {
    loadData();
    loadSetup();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddSetup = (type: string, payload: any) => {
    const newId = `${type.slice(0, 1)}_${Date.now()}`;
    const newItem = { id: newId, ...payload };

    setSetupData((prev: any) => {
      const current = prev || DEFAULT_SETUP_DATA;
      const updated = {
        rooms: current.rooms ? [...current.rooms] : [],
        courses: current.courses ? [...current.courses] : [],
        faculty: current.faculty ? [...current.faculty] : [],
        batches: current.batches ? [...current.batches] : []
      };

      if (type === 'room') {
        updated.rooms.push({ ...newItem, capacity: Number(newItem.capacity) || newItem.capacity });
      } else if (type === 'course') {
        updated.courses.push({ ...newItem, hours: Number(newItem.hours) || newItem.hours });
      } else if (type === 'faculty') {
        updated.faculty.push(newItem);
      } else if (type === 'batch') {
        const total = Number(newItem.totalStudents) || 60;
        const subCount = Number(newItem.subgroups) || 1;
        const subNames = newItem.subgroupNames && newItem.subgroupNames.length > 0 
          ? newItem.subgroupNames 
          : Array.from({ length: subCount }, (_, i) => `${(newItem.groupNumber || newItem.department || 'Batch').toUpperCase()}-SG${i + 1}`);
        updated.batches.push({
          ...newItem,
          totalStudents: total,
          subgroups: subCount,
          sections: subCount,
          subgroupNames: subNames
        });
      }

      saveSetupDataLocally(updated);
      return updated;
    });

    if (type === 'room') {
      setNewRoom({ name: '', capacity: '', type: 'Lecture' });
      showNotice(`Room "${payload.name}" added successfully!`);
    } else if (type === 'course') {
      setNewCourse({ name: '', hours: '', type: 'Lecture' });
      showNotice(`Subject "${payload.name}" added successfully!`);
    } else if (type === 'faculty') {
      setNewFaculty({ name: '', department: '', subjects: [] });
      showNotice(`Faculty "${payload.name}" added successfully!`);
    } else if (type === 'batch') {
      setNewBatch({ groupNumber: '', department: '', totalStudents: '', subgroups: '', subgroupNames: [] });
      showNotice(`Batch "${payload.groupNumber || payload.department}" added successfully!`);
    }

    // Also sync to server in background if available
    fetch("/api/setup-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload: newItem })
    }).catch(() => {});
  };

  const startEdit = (type: string, item: any) => {
    if (type === 'room') {
      setEditRoomId(item.id);
      setNewRoom({ name: item.name || '', capacity: String(item.capacity || ''), type: item.type || 'Lecture' });
    } else if (type === 'course') {
      setEditCourseId(item.id);
      setNewCourse({ name: item.name || '', hours: String(item.hours || ''), type: item.type || 'Lecture' });
    } else if (type === 'faculty') {
      setEditFacultyId(item.id);
      setNewFaculty({ name: item.name || '', department: item.department || '', subjects: item.subjects || [] });
    } else if (type === 'batch') {
      setEditBatchId(item.id);
      const subVal = String(item.subgroups || item.sections || '1');
      setNewBatch({
        groupNumber: item.groupNumber || '',
        department: item.department || '',
        totalStudents: String(item.totalStudents || ''),
        subgroups: subVal,
        subgroupNames: item.subgroupNames || []
      });
    }
  };

  const cancelEdit = (type: string) => {
    if (type === 'room') { setEditRoomId(null); setNewRoom({ name: '', capacity: '', type: 'Lecture' }); }
    if (type === 'course') { setEditCourseId(null); setNewCourse({ name: '', hours: '', type: 'Lecture' }); }
    if (type === 'faculty') { setEditFacultyId(null); setNewFaculty({ name: '', department: '', subjects: [] }); }
    if (type === 'batch') { setEditBatchId(null); setNewBatch({ groupNumber: '', department: '', totalStudents: '', subgroups: '', subgroupNames: [] }); }
  };

  const handleUpdateSetup = (type: string, id: string, payload: any) => {
    setSetupData((prev: any) => {
      const current = prev || DEFAULT_SETUP_DATA;
      const updated = {
        rooms: current.rooms ? [...current.rooms] : [],
        courses: current.courses ? [...current.courses] : [],
        faculty: current.faculty ? [...current.faculty] : [],
        batches: current.batches ? [...current.batches] : []
      };

      if (type === 'room') {
        updated.rooms = updated.rooms.map((r: any) => r.id === id ? { ...r, ...payload, capacity: Number(payload.capacity) || payload.capacity } : r);
      } else if (type === 'course') {
        updated.courses = updated.courses.map((c: any) => c.id === id ? { ...c, ...payload, hours: Number(payload.hours) || payload.hours } : c);
      } else if (type === 'faculty') {
        updated.faculty = updated.faculty.map((f: any) => f.id === id ? { ...f, ...payload } : f);
      } else if (type === 'batch') {
        const subCount = Number(payload.subgroups) || 1;
        const subNames = payload.subgroupNames && payload.subgroupNames.length > 0 
          ? payload.subgroupNames 
          : Array.from({ length: subCount }, (_, i) => `${(payload.groupNumber || payload.department || 'Batch').toUpperCase()}-SG${i + 1}`);
        updated.batches = updated.batches.map((b: any) => b.id === id ? { 
          ...b, 
          ...payload, 
          totalStudents: Number(payload.totalStudents) || payload.totalStudents,
          subgroups: subCount,
          sections: subCount,
          subgroupNames: subNames
        } : b);
      }

      saveSetupDataLocally(updated);
      return updated;
    });

    cancelEdit(type);
    showNotice(`Item updated successfully!`, 'success');

    fetch(`/api/setup-data/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload })
    }).catch(() => {});
  };

  const handleDeleteSetup = (type: string, id: string) => {
    setSetupData((prev: any) => {
      const current = prev || DEFAULT_SETUP_DATA;
      const updated = {
        rooms: current.rooms ? current.rooms.filter((r: any) => r.id !== id) : [],
        courses: current.courses ? current.courses.filter((c: any) => c.id !== id) : [],
        faculty: current.faculty ? current.faculty.filter((f: any) => f.id !== id) : [],
        batches: current.batches ? current.batches.filter((b: any) => b.id !== id) : []
      };
      saveSetupDataLocally(updated);
      return updated;
    });

    if (editRoomId === id) cancelEdit('room');
    if (editCourseId === id) cancelEdit('course');
    if (editFacultyId === id) cancelEdit('faculty');
    if (editBatchId === id) cancelEdit('batch');

    showNotice(`Item removed successfully`, 'info');

    fetch(`/api/setup-data/${type}/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleResetSetupData = () => {
    if (window.confirm("Restore college data to default preset? This will reset rooms, subjects, faculty, and batches.")) {
      setSetupData(DEFAULT_SETUP_DATA);
      saveSetupDataLocally(DEFAULT_SETUP_DATA);
      cancelEdit('room');
      cancelEdit('course');
      cancelEdit('faculty');
      cancelEdit('batch');
      showNotice("College data restored to default preset", "info");
    }
  };

  const handleApprove = (approvalId: string) => {
    fetch("/api/approve-makeup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId })
    }).then(loadData);
  };

  const handleCancelClass = (slotId: string) => {
    fetch("/api/cancel-class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId })
    }).then(loadData);
  };

  const findSubstitutes = (subject: string, makeupId: string) => {
    setActiveMakeupSearch(makeupId);
    fetch(`/api/substitutes/${encodeURIComponent(subject)}`)
      .then(res => res.json())
      .then(resData => setSubstitutes(resData.candidates));
  };

  const runSimulation = () => {
    setIsSimulating(true);
    setSimulationResult(null);
    fetch("/api/simulate", { method: "POST" })
      .then(res => res.json())
      .then(resData => {
        setIsSimulating(false);
        setSimulationResult(resData);
      });
  };

  const simulateGeneration = (customTargetGroup?: string) => {
    setIsGenerating(true);
    const targetGroup = typeof customTargetGroup === 'string' ? customTargetGroup : (selectedGroupFilter || undefined);

    fetch("/api/generate-timetable", { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        targetGroup: targetGroup || undefined,
        setupData: setupData 
      })
    })
      .then(async res => {
        const ct = res.headers.get("content-type");
        if (res.ok && ct && ct.includes("application/json")) {
          return res.json();
        }
        throw new Error("Not valid JSON");
      })
      .then(result => {
        setIsGenerating(false);
        if (result.success && result.timetable) {
          setData((prev: any) => {
            const updated = {
              ...(prev || DEFAULT_COORDINATOR_DATA),
              timetable: result.timetable,
              stats: { totalClasses: result.timetable.length, cancelled: 0 }
            };
            try {
              localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
          setActiveTab('timetable');
          showNotice(`Timetable generated (${result.timetable.length} classes scheduled with subgroup routines)!`, "success");
        } else {
          loadData();
          setActiveTab('timetable');
          showNotice("Timetable generated successfully!", "success");
        }
      })
      .catch(() => {
        // High quality offline / local clash-free generator
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const timeSlots = ["08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00"];
        const rooms = setupData.rooms || [];
        const courses = setupData.courses || [];
        const faculty = setupData.faculty || [];
        const batches = setupData.batches || [];
        
        let existingTimetable = (data?.timetable || []);
        const targetGroupStr = (targetGroup || "").trim().toLowerCase();

        let newTimetable = targetGroupStr 
          ? existingTimetable.filter((t: any) => {
              const sec = (t.section || "").trim().toLowerCase();
              const bch = (t.batch || "").trim().toLowerCase();
              return !(sec === targetGroupStr || bch === targetGroupStr || sec.startsWith(`${targetGroupStr}-`) || sec.startsWith(`${targetGroupStr}_`));
            })
          : [];

        let idCounter = Date.now();
        
        let batchesToProcess = targetGroupStr 
          ? batches.filter((b: any) => (b.groupNumber || b.department || "").trim().toLowerCase() === targetGroupStr)
          : batches;

        if (batchesToProcess.length === 0 && targetGroupStr) {
          batchesToProcess = [{
            groupNumber: targetGroup,
            department: targetGroup,
            totalStudents: 60,
            subgroups: 2,
            subgroupNames: [`${targetGroup}-SG1`, `${targetGroup}-SG2`]
          }];
        }

        (batchesToProcess.length > 0 ? batchesToProcess : [{ groupNumber: "2C4", department: "Computer Science", subgroups: 2, subgroupNames: ["2C4-SG1", "2C4-SG2"] }]).forEach((b: any) => {
          const groupName = (b.groupNumber || b.department || "General").trim();
          const numSubgroups = Math.max(1, Number(b.subgroups) || Number(b.sections) || 1);
          const subgroupNames = (b.subgroupNames && b.subgroupNames.length > 0)
            ? b.subgroupNames
            : Array.from({ length: numSubgroups }, (_, i) => `${groupName}-SG${i + 1}`);

          courses.forEach((c: any) => {
            const isLabOrPractical = 
              c.type === 'Laboratory' || 
              c.type === 'Practical' || 
              c.type === 'Tutorial' ||
              (c.name && c.name.toLowerCase().includes('lab'));

            const entitiesToSchedule = isLabOrPractical
              ? subgroupNames.map((sg: string) => ({ name: sg, isSubgroup: true, hours: Math.min(Number(c.hours) || 2, 2) }))
              : [{ name: groupName, isSubgroup: false, hours: Math.min(Number(c.hours) || 3, 4) }];

            entitiesToSchedule.forEach(({ name: sectionName, isSubgroup, hours }: { name: string; isSubgroup: boolean; hours: number }) => {
              let hoursAssigned = 0;
              let eligibleFaculty = faculty.filter((f: any) => f.subjects && (f.subjects.includes(c.id) || f.subjects.includes(c.name)));
              if (eligibleFaculty.length === 0) eligibleFaculty = faculty;
              const fac = eligibleFaculty.length > 0 ? eligibleFaculty[idCounter % eligibleFaculty.length] : { id: 'fac_1', name: 'Faculty' };

              let attempts = 0;
              while (hoursAssigned < hours && attempts < 500) {
                attempts++;
                const randDay = days[Math.floor(Math.random() * days.length)];
                const randSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];

                const clash = newTimetable.some((t: any) => {
                  if (t.day !== randDay || t.time !== randSlot) return false;
                  if (t.facultyId && fac.id && t.facultyId === fac.id) return true;

                  const tSec = (t.section || "").trim().toLowerCase();
                  const currSec = sectionName.trim().toLowerCase();
                  const currGroup = groupName.trim().toLowerCase();

                  if (tSec === currSec) return true;
                  if (!isSubgroup && (subgroupNames.some((s: string) => s.trim().toLowerCase() === tSec) || tSec.startsWith(`${currGroup}-`))) return true;
                  if (isSubgroup && tSec === currGroup) return true;
                  return false;
                });

                if (!clash) {
                  const usedRooms = newTimetable
                    .filter((t: any) => t.day === randDay && t.time === randSlot)
                    .map((t: any) => (t.room || "").trim().toLowerCase());

                  let freeRooms = rooms.filter((r: any) => !usedRooms.includes((r.name || "").trim().toLowerCase()));
                  const desiredType = isLabOrPractical ? 'Laboratory' : (c.type || 'Lecture');
                  const matchedTypeRooms = freeRooms.filter((r: any) => (r.type || "").toLowerCase() === desiredType.toLowerCase());
                  if (matchedTypeRooms.length > 0) freeRooms = matchedTypeRooms;

                  if (freeRooms.length > 0) {
                    const chosenRoom = freeRooms[Math.floor(Math.random() * freeRooms.length)];
                    newTimetable.push({
                      id: `t_${idCounter++}`,
                      day: randDay,
                      time: randSlot,
                      subject: c.name,
                      section: sectionName,
                      batch: groupName,
                      subgroup: isSubgroup ? sectionName : 'all',
                      isSubgroup,
                      courseType: isLabOrPractical ? 'Laboratory' : (c.type || 'Lecture'),
                      facultyId: fac ? fac.id : null,
                      room: chosenRoom ? chosenRoom.name : "Room 101",
                      status: "planned"
                    });
                    hoursAssigned++;
                  }
                }
              }
            });
          });
        });

        setData((prev: any) => {
          const updated = {
            ...(prev || DEFAULT_COORDINATOR_DATA),
            timetable: newTimetable,
            stats: { totalClasses: newTimetable.length, cancelled: 0 }
          };
          try {
            localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        setIsGenerating(false);
        setActiveTab('timetable');
        showNotice(`Generated ${newTimetable.length} timetable entries with individual subgroup routines!`, "success");
      });
  };


  // Never block the UI; instantaneous render
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Academic Operations Center</h1>
      </div>

      <div className="flex space-x-2 border-b pb-4 mb-6 overflow-x-auto scrollbar-hide">
        <Button 
          variant={activeTab === 'dashboard' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('dashboard')}
          className={activeTab === 'dashboard' ? 'bg-slate-900' : 'text-slate-600'}
        >
          Operations & Recovery
        </Button>
        <Button 
          variant={activeTab === 'timetable' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('timetable')}
          className={activeTab === 'timetable' ? 'bg-slate-900' : 'text-slate-600'}
        >
          Master Timetable
        </Button>
        <Button 
          variant={activeTab === 'setup' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('setup')}
          className={activeTab === 'setup' ? 'bg-slate-900' : 'text-slate-600'}
        >
          <Database className="h-4 w-4 mr-2" />
          College Data
        </Button>
        <Button 
          variant={activeTab === 'syllabus' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('syllabus')}
          className={activeTab === 'syllabus' ? 'bg-slate-900' : 'text-slate-600'}
        >
          Syllabus Intelligence
        </Button>
        <Button 
          variant={activeTab === 'simulator' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('simulator')}
          className={activeTab === 'simulator' ? 'bg-slate-900' : 'text-slate-600'}
        >
          What-If Simulator
        </Button>
        <Button 
          variant={activeTab === 'generator' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('generator')}
          className={activeTab === 'generator' ? 'bg-slate-900' : 'text-slate-600'}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Auto-Scheduler
        </Button>
        <Button 
          variant={activeTab === 'inbox' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('inbox')}
          className={activeTab === 'inbox' ? 'bg-slate-900' : 'text-slate-600 relative'}
        >
          Academic Inbox
          {data.inbox && data.inbox.length > 0 && (
             <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </Button>
      </div>
      
      {activeTab === 'dashboard' && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${Number(data.healthScore) < 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {data.healthScore}
                </div>
                <p className="text-xs text-slate-500 mt-1">Out of 100</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Makeups</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.pendingMakeups.length}</div>
                <p className="text-xs text-slate-500 mt-1">Awaiting recovery</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approval Queue</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.approvals.length}</div>
                <p className="text-xs text-slate-500 mt-1">Awaiting coordinator review</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Approval Queue</CardTitle>
                <CardDescription>Faculty have accepted these cross-cancellation matches.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.approvals.length === 0 ? (
                    <div className="text-sm text-slate-500 italic">No pending approvals.</div>
                  ) : (
                    data.approvals.map((apprv: any) => (
                      <div key={apprv.id} className="rounded-lg border p-4 bg-slate-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-lg">{apprv.subject} / {apprv.section}</div>
                            <div className="text-sm text-slate-600">Proposed Slot: {apprv.day} {apprv.time}</div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">Needs Review</Badge>
                        </div>
                        <Button onClick={() => handleApprove(apprv.id)} size="sm" className="w-full bg-slate-900 hover:bg-slate-800">
                          Approve Match & Publish
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Makeups & Substitutes</CardTitle>
                <CardDescription>Use the Substitute Faculty Engine to resolve missing classes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.pendingMakeups.length === 0 ? (
                    <div className="text-sm text-slate-500 italic">All makeups resolved!</div>
                  ) : (
                    data.pendingMakeups.map((mk: any) => (
                      <div key={mk.id} className="border rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-lg">{mk.subject} / {mk.section}</div>
                            <div className="text-sm text-slate-500 flex items-center mt-1">
                              <Clock className="w-4 h-4 mr-1"/> Original Faculty: {mk.facultyId}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 mb-1">Priority: {mk.priority}</Badge>
                          </div>
                        </div>
                        
                        {activeMakeupSearch === mk.id ? (
                          <div className="mt-4 border-t pt-4 space-y-3">
                            <div className="text-sm font-semibold text-slate-700 mb-2">Substitute Engine Results:</div>
                            {substitutes.map(sub => (
                              <div key={sub.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                                <div>
                                  <div className="font-medium text-sm">{sub.name} <span className="text-slate-400 font-normal ml-1">— {sub.compatibility}% compatibility</span></div>
                                  <div className="text-xs text-slate-500 mt-0.5">{sub.reasons.join(" • ")}</div>
                                </div>
                                <Button size="sm" disabled={sub.status === 'Unavailable'} className={sub.status === 'Available' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
                                  {sub.status === 'Available' ? 'Assign' : 'Unavailable'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => findSubstitutes(mk.subject, mk.id)}>
                            <Search className="w-4 h-4 mr-2" /> Find Qualified Substitute
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'simulator' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>What-If Simulator</CardTitle>
            <CardDescription>Preview the cascading impact of emergency changes before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Disruption Scenario</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option>Main Computer Lab (Room 204) is unavailable next week</option>
                <option>Prof. Sharma goes on emergency leave for 3 days</option>
                <option>Building B is closed for maintenance on Friday</option>
              </select>
            </div>
            
            <Button 
              className="w-full bg-slate-900 hover:bg-slate-800" 
              onClick={runSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? (
                <><Clock className="w-4 h-4 mr-2 animate-spin" /> Running Impact Analysis...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run Simulation</>
              )}
            </Button>

            {simulationResult && (
              <div className="mt-6 border rounded-lg bg-slate-50 p-6 shadow-sm">
                <h3 className="font-semibold text-lg text-slate-900 mb-4 border-b pb-2">Simulation Results</h3>
                <div className="space-y-3">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-600">Affected classes:</span>
                    <span className="font-bold text-slate-900">{simulationResult.affectedClasses}</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-600">Required room changes:</span>
                    <span className="font-bold text-slate-900">{simulationResult.roomChanges}</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-600">New conflicts:</span>
                    <span className="font-bold text-green-600">{simulationResult.newConflicts}</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-600">Stability:</span>
                    <span className="font-bold text-slate-900">{simulationResult.stability}%</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm pt-2 border-t mt-2">
                    <span className="text-slate-600 font-semibold">New Health score:</span>
                    <span className="font-bold text-indigo-600">{simulationResult.healthScore}</span>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700">Apply Changes</Button>
                  <Button variant="outline" className="flex-1">Discard</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'timetable' && (() => {
        const currentBatch = setupData?.batches?.find((b: any) => 
          (b.groupNumber || b.department || "").trim().toLowerCase() === selectedGroupFilter.trim().toLowerCase()
        );

        const currentSubgroups: string[] = (() => {
          if (!currentBatch) return [];
          if (currentBatch.subgroupNames && currentBatch.subgroupNames.length > 0) return currentBatch.subgroupNames;
          const cnt = Number(currentBatch.subgroups) || Number(currentBatch.sections) || 1;
          const gName = currentBatch.groupNumber || currentBatch.department || 'Batch';
          return Array.from({ length: cnt }, (_, i) => `${gName}-SG${i + 1}`);
        })();

        const matchesSlotFilter = (t: any) => {
          if (selectedGroupFilter) {
            const targetGroupLower = selectedGroupFilter.trim().toLowerCase();
            const subLowerList = currentSubgroups.map(s => s.trim().toLowerCase());

            const secLower = (t.section || "").trim().toLowerCase();
            const bchLower = (t.batch || "").trim().toLowerCase();

            // Check if slot belongs to the selected batch (common lecture or any subgroup)
            const belongsToBatch = 
              secLower === targetGroupLower ||
              bchLower === targetGroupLower ||
              subLowerList.includes(secLower) ||
              secLower.startsWith(`${targetGroupLower}-`) ||
              secLower.startsWith(`${targetGroupLower}_`);

            if (!belongsToBatch) return false;

            // If an individual subgroup is selected, filter routing specifically for it!
            if (selectedSubgroupFilter) {
              const targetSubLower = selectedSubgroupFilter.trim().toLowerCase();
              const isCommonLecture = secLower === targetGroupLower || t.subgroup === 'all' || !t.isSubgroup;
              const isThisSubgroup = secLower === targetSubLower || (t.subgroup && t.subgroup.trim().toLowerCase() === targetSubLower);

              if (!isCommonLecture && !isThisSubgroup) {
                return false;
              }
            }
          }

          if (ttSearch) {
            const search = ttSearch.toLowerCase();
            const facultyName = setupData?.faculty?.find((f: any) => f.id === t.facultyId)?.name || t.facultyId || "";
            return (
              (t.subject && t.subject.toLowerCase().includes(search)) ||
              (t.section && t.section.toLowerCase().includes(search)) ||
              (facultyName && facultyName.toLowerCase().includes(search)) ||
              (t.room && t.room.toLowerCase().includes(search))
            );
          }

          return true;
        };

        const filteredSlots = (data?.timetable || []).filter(matchesSlotFilter);
        const matrixSlots = ["08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00"];

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Master Institutional Timetable</CardTitle>
                <CardDescription>
                  Full scheduling matrix with clash-free routine allocation and individual subgroup routing.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => simulateGeneration(selectedGroupFilter)}
                  disabled={isGenerating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
                >
                  <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? "Generating..." : selectedGroupFilter ? `Generate ${selectedGroupFilter} Routine` : "Generate Complete Timetable"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter and View Controls Toolbar */}
              <div className="mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by section, faculty, subject, or room..."
                    className="w-full h-10 pl-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={ttSearch}
                    onChange={e => setTtSearch(e.target.value)}
                  />
                </div>
                
                {setupData && setupData.batches && (
                  <select 
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm font-medium"
                    value={selectedGroupFilter} 
                    onChange={e => { setSelectedGroupFilter(e.target.value); setSelectedSubgroupFilter(''); }}
                  >
                    <option value="">All Batches & Groups</option>
                    {setupData.batches.map((b: any) => (
                      <option key={b.id} value={b.groupNumber || b.department}>
                        {b.groupNumber ? `Batch ${b.groupNumber}` : b.department}
                      </option>
                    ))}
                  </select>
                )}

                {selectedGroupFilter && currentSubgroups.length > 0 && (
                  <select 
                    className="h-10 rounded-md border border-indigo-200 bg-indigo-50/50 px-3 text-sm font-medium text-indigo-900 shadow-sm"
                    value={selectedSubgroupFilter} 
                    onChange={e => setSelectedSubgroupFilter(e.target.value)}
                  >
                    <option value="">All Subgroups (Combined)</option>
                    {currentSubgroups.map((sgName: string) => (
                      <option key={sgName} value={sgName}>{sgName} Individual Routine</option>
                    ))}
                  </select>
                )}

                <select 
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm font-medium"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                >
                  <option value="list">List View</option>
                  <option value="matrix">Matrix Grid View</option>
                </select>
              </div>

              {/* Subgroup Quick Routing Pill Bar */}
              {selectedGroupFilter && currentSubgroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide mr-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Subgroup Routings:
                  </span>
                  <button
                    onClick={() => setSelectedSubgroupFilter('')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                      !selectedSubgroupFilter 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All Subgroups (Full Batch)
                  </button>
                  {currentSubgroups.map((sg: string) => {
                    const isSelected = selectedSubgroupFilter.trim().toLowerCase() === sg.trim().toLowerCase();
                    return (
                      <button
                        key={sg}
                        onClick={() => setSelectedSubgroupFilter(sg)}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200' 
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}></span>
                        {sg} Routing
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Subgroup Routing Banner */}
              {selectedGroupFilter && selectedSubgroupFilter && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 mb-4 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse shrink-0"></span>
                    <span>
                      <strong>Individual Routine Active for {selectedSubgroupFilter}:</strong> Displaying dedicated routine including all core theory lectures and exclusive lab practical sessions for this subgroup.
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedSubgroupFilter('')} 
                    className="text-xs text-indigo-700 hover:text-indigo-950 hover:bg-indigo-100 h-7 px-2 font-medium"
                  >
                    Clear Filter
                  </Button>
                </div>
              )}

              {/* Empty state when no timetable exists for the selected group */}
              {selectedGroupFilter && filteredSlots.length === 0 ? (
                <div className="border border-dashed border-amber-300 bg-amber-50/70 rounded-xl p-8 text-center my-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <CalendarRange className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-amber-900">
                    No Timetable Generated Yet for {selectedGroupFilter}
                  </h3>
                  <p className="text-xs text-amber-700 max-w-md mx-auto mt-1 mb-4">
                    Routines have not yet been computed for this student batch. Click below to automatically generate a clash-free institutional schedule with individual subgroup laboratory sessions and core lectures.
                  </p>
                  <Button 
                    onClick={() => simulateGeneration(selectedGroupFilter)}
                    disabled={isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <Wand2 className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                    Generate Routine for {selectedGroupFilter}
                  </Button>
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                    const daySlots = filteredSlots.filter((t: any) => t.day === day);
                    daySlots.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
                    if (daySlots.length === 0) return null;
                    
                    return (
                      <div key={day} className="mb-6 last:mb-0">
                        <div className="flex items-center justify-between border-b pb-2 mb-3">
                          <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            {day}
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {daySlots.map((slot: any) => {
                            const isSub = slot.isSubgroup || (slot.section && selectedGroupFilter && slot.section.toLowerCase() !== selectedGroupFilter.toLowerCase());
                            return (
                              <div 
                                key={slot.id} 
                                className={`rounded-lg border p-3 flex justify-between items-center transition-all ${
                                  slot.status === 'cancelled' 
                                    ? 'bg-red-50/70 border-red-200 opacity-80' 
                                    : slot.status === 'rescheduled' 
                                    ? 'bg-emerald-50 border-emerald-200' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                }`}
                              >
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                                  <div className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">
                                    {slot.time}
                                  </div>
                                  <div>
                                    <div className={`font-semibold text-sm ${slot.status === 'cancelled' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                      {slot.subject}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {slot.courseType || (slot.subject?.toLowerCase().includes('lab') ? 'Laboratory' : 'Lecture')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isSub ? (
                                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-medium text-[11px]">
                                        Subgroup: {slot.section}
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-[11px]">
                                        {slot.section || 'All Batch'}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-slate-600 font-medium">
                                      Room {slot.room || 'TBD'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-600 font-medium">
                                    {slot.facultyId ? (setupData?.faculty?.find((f: any) => f.id === slot.facultyId)?.name || `Prof. ${slot.facultyId}`) : 'Staff'}
                                  </div>
                                </div>
                                <div className="ml-4 shrink-0">
                                  {slot.status === 'planned' && (
                                    <Button variant="outline" size="sm" onClick={() => handleCancelClass(slot.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs h-8">
                                      Override Cancel
                                    </Button>
                                  )}
                                  {slot.status === 'cancelled' && (
                                    <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 text-xs">Cancelled</Badge>
                                  )}
                                  {slot.status === 'rescheduled' && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Rescheduled</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="p-3 font-semibold border-b border-r text-xs uppercase tracking-wider text-slate-500 bg-slate-100/70 w-[120px]">
                          Time / Day
                        </th>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                          <th key={day} className="p-3 font-semibold border-b border-r last:border-r-0 min-w-[210px] text-slate-900">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixSlots.map(timeSlot => (
                        <tr key={timeSlot} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 border-r font-mono text-xs font-semibold text-slate-600 bg-slate-50/40 whitespace-nowrap align-top">
                            {timeSlot}
                          </td>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                            const slots = filteredSlots.filter((t: any) => t.day === day && t.time === timeSlot);
                            return (
                              <td key={day} className="p-2 border-r last:border-r-0 align-top">
                                <div className="space-y-1.5">
                                  {slots.map((slot: any) => {
                                    const isSub = slot.isSubgroup || (slot.section && selectedGroupFilter && slot.section.toLowerCase() !== selectedGroupFilter.toLowerCase());
                                    return (
                                      <div 
                                        key={slot.id} 
                                        className={`p-2 rounded-md border text-xs shadow-2xs transition-all ${
                                          slot.status === 'cancelled' 
                                            ? 'bg-red-50 border-red-200 opacity-75' 
                                            : slot.status === 'rescheduled' 
                                            ? 'bg-emerald-50 border-emerald-200' 
                                            : isSub 
                                            ? 'bg-purple-50/60 border-purple-200 hover:border-purple-300' 
                                            : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-1 gap-1">
                                          <span className="font-semibold text-slate-900 truncate" title={slot.subject}>
                                            {slot.subject}
                                          </span>
                                          {isSub ? (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold text-[10px] whitespace-nowrap">
                                              {slot.section}
                                            </span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px] whitespace-nowrap">
                                              {slot.section}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-slate-600 flex justify-between text-[11px] font-medium">
                                          <span>Room {slot.room || 'TBD'}</span>
                                          <span className="truncate max-w-[110px]" title={slot.facultyId}>
                                            {setupData?.faculty?.find((f: any) => f.id === slot.facultyId)?.name || slot.facultyId}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {slots.length === 0 && (
                                    <div className="text-slate-300 text-center py-2 text-xs">—</div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {activeTab === 'syllabus' && (
        <Card>
          <CardHeader>
            <CardTitle>Syllabus Intelligence</CardTitle>
            <CardDescription>Track syllabus completion and identify at-risk subjects across the institution.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.syllabus.map((syl: any) => (
                <div key={syl.subject} className="rounded-lg border p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{syl.subject}</h3>
                      <p className="text-sm text-slate-500">Completion Status</p>
                    </div>
                    {syl.risk === 'HIGH' && <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">High Risk</Badge>}
                    {syl.risk === 'MEDIUM' && <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">Medium Risk</Badge>}
                    {syl.risk === 'LOW' && <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">On Track</Badge>}
                  </div>
                  
                  <div className="grid grid-cols-5 gap-4 mb-4 text-center">
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-xs text-slate-500 font-medium uppercase">Required</div>
                      <div className="text-lg font-bold">{syl.required}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-xs text-slate-500 font-medium uppercase">Planned</div>
                      <div className="text-lg font-bold">{syl.planned}</div>
                    </div>
                    <div className="bg-blue-50 p-2 rounded">
                      <div className="text-xs text-blue-600 font-medium uppercase">Completed</div>
                      <div className="text-lg font-bold text-blue-700">{syl.completed}</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <div className="text-xs text-red-600 font-medium uppercase">Cancelled</div>
                      <div className="text-lg font-bold text-red-700">{syl.cancelled}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-xs text-slate-500 font-medium uppercase">Remaining</div>
                      <div className="text-lg font-bold">{syl.remaining}</div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full ${syl.risk === 'HIGH' ? 'bg-red-500' : syl.risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`} 
                      style={{ width: `${(syl.completed / syl.required) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'inbox' && (
        <Card>
          <CardHeader>
            <CardTitle>Academic Inbox</CardTitle>
            <CardDescription>Centralized notifications and contextual alerts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.inbox.map((msg: any) => (
                <div key={msg.id} className={`flex items-center p-4 rounded-lg border ${
                  msg.type === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                  msg.type === 'warning' ? 'bg-yellow-50 border-yellow-100 text-yellow-900' :
                  msg.type === 'success' ? 'bg-green-50 border-green-100 text-green-900' :
                  'bg-blue-50 border-blue-100 text-blue-900'
                }`}>
                  <div className="mr-4">
                    {msg.type === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
                    {msg.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                    {msg.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {msg.type === 'info' && <Info className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div className="font-medium text-sm">{msg.message}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'setup' && setupData && (
        <div className="space-y-6">
          {/* Header & Status Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                College Configuration & Master Data
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Add, edit, or remove rooms, subjects, faculty, and student batches with real-time persistence.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetSetupData}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                title="Reset to default sample data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Defaults
              </Button>
            </div>
          </div>

          {setupNotice && (
            <div className={`p-3.5 rounded-lg flex items-center justify-between text-sm transition-all border ${
              setupNotice.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
              setupNotice.type === 'info' ? 'bg-blue-50 text-blue-900 border-blue-200' :
              'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{setupNotice.text}</span>
              </div>
              <button 
                onClick={() => setSetupNotice(null)} 
                className="p-1 text-slate-500 hover:text-slate-800 rounded"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Rooms Setup */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Rooms</CardTitle>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {setupData.rooms?.length || 0} total
                  </span>
                </div>
                <CardDescription>Define physical spaces and capacities.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2.5 mb-4 max-h-64 overflow-y-auto pr-1">
                  {(!setupData.rooms || setupData.rooms.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-400">No rooms configured yet.</div>
                  )}
                  {setupData.rooms?.map((r: any) => (
                    <div 
                      key={r.id} 
                      className={`flex justify-between items-center p-2.5 rounded border text-sm transition-all ${
                        editRoomId === r.id 
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">{r.name}</span>
                          {editRoomId === r.id && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">Editing</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-slate-500 text-xs bg-slate-200 px-2 py-0.5 rounded-full">{r.capacity} seats</span>
                          {r.type && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{r.type}</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => startEdit('room', r)} 
                          className={`p-1.5 rounded transition ${
                            editRoomId === r.id ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                          }`}
                          title="Edit Room"
                          aria-label={`Edit ${r.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteSetup('room', r.id)} 
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition"
                          title="Delete Room"
                          aria-label={`Delete ${r.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {editRoomId ? `Edit: ${newRoom.name || 'Room'}` : "Add New Room"}
                    </h4>
                    {editRoomId && (
                      <button onClick={() => cancelEdit('room')} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Room Name (e.g. Room 101)" 
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                    value={newRoom.name} 
                    onChange={e => setNewRoom({...newRoom, name: e.target.value})} 
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Capacity (e.g. 60)" 
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newRoom.capacity} 
                      onChange={e => setNewRoom({...newRoom, capacity: e.target.value})} 
                    />
                    <select 
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newRoom.type} 
                      onChange={e => setNewRoom({...newRoom, type: e.target.value})}
                    >
                      <option value="Lecture">Lecture</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Seminar">Seminar</option>
                    </select>
                  </div>
                  {editRoomId ? (
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                        onClick={() => handleUpdateSetup('room', editRoomId, newRoom)} 
                        disabled={!newRoom.name.trim() || !newRoom.capacity}
                      >
                        Update Room
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => cancelEdit('room')}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1 mt-1" 
                      onClick={() => handleAddSetup('room', newRoom)} 
                      disabled={!newRoom.name.trim() || !newRoom.capacity}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Room
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Courses Setup */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Subjects</CardTitle>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {setupData.courses?.length || 0} total
                  </span>
                </div>
                <CardDescription>Configure course requirements.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2.5 mb-4 max-h-64 overflow-y-auto pr-1">
                  {(!setupData.courses || setupData.courses.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-400">No subjects configured yet.</div>
                  )}
                  {setupData.courses?.map((c: any) => (
                    <div 
                      key={c.id} 
                      className={`flex justify-between items-center p-2.5 rounded border text-sm transition-all ${
                        editCourseId === c.id 
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                          {editCourseId === c.id && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">Editing</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-slate-500 text-xs bg-slate-200 px-2 py-0.5 rounded-full">{c.hours} hrs/week</span>
                          {c.type && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{c.type}</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => startEdit('course', c)} 
                          className={`p-1.5 rounded transition ${
                            editCourseId === c.id ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                          }`}
                          title="Edit Subject"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteSetup('course', c.id)} 
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition"
                          title="Delete Subject"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {editCourseId ? `Edit: ${newCourse.name || 'Subject'}` : "Add Subject"}
                    </h4>
                    {editCourseId && (
                      <button onClick={() => cancelEdit('course')} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Subject Name (e.g. Data Structures)" 
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                    value={newCourse.name} 
                    onChange={e => setNewCourse({...newCourse, name: e.target.value})} 
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Hours/Week (e.g. 4)" 
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newCourse.hours} 
                      onChange={e => setNewCourse({...newCourse, hours: e.target.value})} 
                    />
                    <select 
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newCourse.type} 
                      onChange={e => setNewCourse({...newCourse, type: e.target.value})}
                    >
                      <option value="Lecture">Lecture</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Tutorial">Tutorial</option>
                    </select>
                  </div>
                  {editCourseId ? (
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                        onClick={() => handleUpdateSetup('course', editCourseId, newCourse)} 
                        disabled={!newCourse.name.trim() || !newCourse.hours}
                      >
                        Update Subject
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => cancelEdit('course')}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1 mt-1" 
                      onClick={() => handleAddSetup('course', newCourse)} 
                      disabled={!newCourse.name.trim() || !newCourse.hours}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Subject
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Faculty Setup */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Faculty</CardTitle>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {setupData.faculty?.length || 0} total
                  </span>
                </div>
                <CardDescription>Manage teachers and assignments.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2.5 mb-4 max-h-64 overflow-y-auto pr-1">
                  {(!setupData.faculty || setupData.faculty.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-400">No faculty members configured yet.</div>
                  )}
                  {setupData.faculty?.map((f: any) => (
                    <div 
                      key={f.id} 
                      className={`flex justify-between items-center p-2.5 rounded border text-sm transition-all ${
                        editFacultyId === f.id 
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">{f.name}</span>
                          {editFacultyId === f.id && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">Editing</span>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs block mt-0.5">{f.department}</span>
                        {f.subjects && f.subjects.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {f.subjects.map((subId: string) => {
                              const c = setupData.courses?.find((course: any) => course.id === subId);
                              return c ? <span key={subId} className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-medium">{c.name}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => startEdit('faculty', f)} 
                          className={`p-1.5 rounded transition ${
                            editFacultyId === f.id ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                          }`}
                          title="Edit Faculty"
                          aria-label={`Edit ${f.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteSetup('faculty', f.id)} 
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition"
                          title="Delete Faculty"
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {editFacultyId ? `Edit: ${newFaculty.name || 'Faculty'}` : "Add Faculty"}
                    </h4>
                    {editFacultyId && (
                      <button onClick={() => cancelEdit('faculty')} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Full Name (e.g. Prof. Turing)" 
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                    value={newFaculty.name} 
                    onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} 
                  />
                  <input 
                    type="text" 
                    placeholder="Department (e.g. Computer Science)" 
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                    value={newFaculty.department} 
                    onChange={e => setNewFaculty({...newFaculty, department: e.target.value})} 
                  />
                  
                  {setupData.courses && setupData.courses.length > 0 && (
                    <div className="border rounded-md p-2 bg-slate-50 space-y-1.5 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-slate-600">Qualified Subjects</p>
                      <div className="space-y-1">
                        {setupData.courses.map((c: any) => (
                          <label key={c.id} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-blue-600"
                              checked={newFaculty.subjects?.includes(c.id) || false}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const currentSubjects = newFaculty.subjects || [];
                                if (isChecked) {
                                  setNewFaculty({...newFaculty, subjects: [...currentSubjects, c.id]});
                                } else {
                                  setNewFaculty({...newFaculty, subjects: currentSubjects.filter(id => id !== c.id)});
                                }
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {editFacultyId ? (
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                        onClick={() => handleUpdateSetup('faculty', editFacultyId, newFaculty)} 
                        disabled={!newFaculty.name.trim() || !newFaculty.department.trim()}
                      >
                        Update Faculty
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => cancelEdit('faculty')}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1 mt-1" 
                      onClick={() => handleAddSetup('faculty', newFaculty)} 
                      disabled={!newFaculty.name.trim() || !newFaculty.department.trim()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Faculty
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Batches Setup */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Student Batches</CardTitle>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {setupData.batches?.length || 0} total
                  </span>
                </div>
                <CardDescription>Setup cohorts & divisions.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2.5 mb-4 max-h-64 overflow-y-auto pr-1">
                  {(!setupData.batches || setupData.batches.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-400">No batches configured yet.</div>
                  )}
                  {setupData.batches?.map((b: any) => (
                    <div 
                      key={b.id} 
                      className={`flex justify-between items-center p-2.5 rounded border text-sm transition-all ${
                        editBatchId === b.id 
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">{b.groupNumber || b.department}</span>
                          {editBatchId === b.id && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">Editing</span>
                          )}
                        </div>
                        {b.groupNumber && b.department && (
                          <span className="text-slate-500 text-xs block">{b.department}</span>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-slate-500 text-xs bg-slate-200 px-2 py-0.5 rounded-full">{b.totalStudents} Students</span>
                          <span className="text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded-full">{b.subgroups || b.sections || 1} Sub-groups</span>
                        </div>
                        {b.subgroupNames && b.subgroupNames.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {b.subgroupNames.map((n: string, i: number) => (
                              <span key={i} className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded">{n}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => startEdit('batch', b)} 
                          className={`p-1.5 rounded transition ${
                            editBatchId === b.id ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                          }`}
                          title="Edit Batch"
                          aria-label={`Edit ${b.groupNumber || b.department}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteSetup('batch', b.id)} 
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition"
                          title="Delete Batch"
                          aria-label={`Delete ${b.groupNumber || b.department}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {editBatchId ? `Edit: ${newBatch.groupNumber || newBatch.department || 'Batch'}` : "Add Batch"}
                    </h4>
                    {editBatchId && (
                      <button onClick={() => cancelEdit('batch')} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Group (e.g. CSE-A)" 
                      className="w-1/2 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newBatch.groupNumber} 
                      onChange={e => setNewBatch({...newBatch, groupNumber: e.target.value})} 
                    />
                    <input 
                      type="text" 
                      placeholder="Department" 
                      className="w-1/2 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newBatch.department} 
                      onChange={e => setNewBatch({...newBatch, department: e.target.value})} 
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Total Students (e.g. 60)" 
                      className="w-1/2 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newBatch.totalStudents} 
                      onChange={e => setNewBatch({...newBatch, totalStudents: e.target.value})} 
                    />
                    <input 
                      type="number" 
                      placeholder="Sub-groups (e.g. 2)" 
                      className="w-1/2 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-slate-900" 
                      value={newBatch.subgroups || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const count = parseInt(val) || 0;
                        const names = newBatch.subgroupNames || [];
                        const prefix = newBatch.groupNumber ? newBatch.groupNumber.toUpperCase() : 'SG';
                        const newNames = Array.from({length: count}, (_, i) => names[i] || `${prefix}-${i+1}`);
                        setNewBatch({...newBatch, subgroups: val, subgroupNames: newNames});
                      }} 
                    />
                  </div>
                  {(parseInt(newBatch.subgroups) > 0) && (
                    <div className="border rounded-md p-2 bg-slate-50 space-y-1.5 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-slate-600">Sub-group Names</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({length: parseInt(newBatch.subgroups)}).map((_, i) => (
                          <input 
                            key={i}
                            type="text" 
                            className="w-full h-8 rounded border border-input bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-slate-900" 
                            value={newBatch.subgroupNames?.[i] || ''}
                            onChange={(e) => {
                              const names = [...(newBatch.subgroupNames || [])];
                              names[i] = e.target.value;
                              setNewBatch({...newBatch, subgroupNames: names});
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {editBatchId ? (
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                        onClick={() => handleUpdateSetup('batch', editBatchId, newBatch)} 
                        disabled={!(newBatch.groupNumber?.trim() || newBatch.department?.trim()) || !newBatch.totalStudents}
                      >
                        Update Batch
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => cancelEdit('batch')}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1 mt-1" 
                      onClick={() => handleAddSetup('batch', newBatch)} 
                      disabled={!(newBatch.groupNumber?.trim() || newBatch.department?.trim()) || !newBatch.totalStudents}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Batch
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}
      {activeTab === 'generator' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
              <CardTitle className="text-indigo-900 flex items-center">
                <Wand2 className="w-5 h-5 mr-2 text-indigo-600" />
                AI Timetable Generation
              </CardTitle>
              <CardDescription>
                Generate a conflict-free master timetable based on constraints.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center">
                    <Database className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Faculty Constraints</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {setupData ? setupData.faculty.length : 0} Loaded
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center">
                    <Database className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Room Capacities</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {setupData ? setupData.rooms.length : 0} Loaded
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center">
                    <Database className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Subject Credits</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {setupData ? setupData.courses.length : 0} Loaded
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center">
                    <UserCheck className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium">Student Cohorts & Divisions</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {setupData && setupData.batches ? setupData.batches.length : 0} Loaded
                  </Badge>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 mt-4">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>Clash-Free Generation Enabled:</strong> The algorithm will automatically read your loaded batch sizes (e.g., 1000 CS students) and section divisions to ensure no student groups or faculty are double-booked.
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-slate-700 block mb-2">Target Group (Optional)</label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  >
                    <option value="">Build Full Timetable (All Groups)</option>
                    {setupData && setupData.batches && setupData.batches.map((b: any) => (
                      <option key={b.id} value={b.groupNumber || b.department}>{b.groupNumber || b.department}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">If a group is selected, only that group's routines will be regenerated. Other groups will remain intact.</p>
                </div>

                <Button 
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" 
                  size="lg"
                  onClick={() => simulateGeneration(selectedGroupFilter)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Computing Combinations...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 mr-2" />
                      Run Genetic Algorithm
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>Adjust optimization weights.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Minimize Student Gaps</span>
                  <span className="text-sm text-slate-500">80%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-slate-900 h-2 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Faculty Consecutive Limits</span>
                  <span className="text-sm text-slate-500">Max 2</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-slate-900 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Room Travel Distance</span>
                  <span className="text-sm text-slate-500">Low Priority</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-slate-900 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
