export const DEFAULT_COORDINATOR_DATA = {
  healthScore: "98.0",
  pendingMakeups: [
    { id: "mk_1", subject: "DBMS", section: "CSE-A", facultyId: "sharma", originalSlotId: "t1", priority: 94 }
  ],
  approvals: [],
  timetable: [
    { id: "t1", day: "Monday", time: "08:00 - 09:00", subject: "DBMS", section: "CSE-A", facultyId: "sharma", room: "204", status: "cancelled" },
    { id: "t2", day: "Monday", time: "09:00 - 10:00", subject: "FREE", section: "CSE-A", facultyId: null, room: null, status: "planned" },
    { id: "t3", day: "Thursday", time: "10:00 - 11:00", subject: "Mathematics", section: "CSE-A", facultyId: "math_prof", room: "101", status: "planned" },
    { id: "t4", day: "Thursday", time: "11:00 - 12:00", subject: "OS", section: "CSE-A", facultyId: "gupta", room: "205", status: "planned" },
    { id: "t5", day: "Friday", time: "14:00 - 15:00", subject: "DBMS Lab", section: "CSE-A", facultyId: "sharma", room: "Lab 1", status: "planned" }
  ],
  inbox: [
    { id: 1, type: "error", message: "Makeup request from CSE-A" },
    { id: 2, type: "warning", message: "Room changed for OS (CSE-B)" },
    { id: 3, type: "success", message: "Class confirmed for Mathematics" },
    { id: 4, type: "info", message: "Department meeting at 4 PM" },
    { id: 5, type: "success", message: "Timetable updated to Version 4" }
  ],
  syllabus: [
    { subject: "DBMS", required: 45, planned: 45, completed: 38, cancelled: 2, remaining: 7, risk: "HIGH", statusColor: "red" },
    { subject: "OS", required: 40, planned: 40, completed: 30, cancelled: 0, remaining: 10, risk: "LOW", statusColor: "green" },
    { subject: "Mathematics", required: 50, planned: 50, completed: 42, cancelled: 1, remaining: 8, risk: "MEDIUM", statusColor: "yellow" }
  ],
  stats: { totalClasses: 5, cancelled: 1 }
};

export const DEFAULT_SETUP_DATA = {
  rooms: [
    { id: "r1", name: "Room 101", capacity: 60, type: "Lecture" },
    { id: "r2", name: "Room 204", capacity: 40, type: "Lecture" },
    { id: "r3", name: "Lab 1", capacity: 30, type: "Laboratory" },
    { id: "r4", name: "Lab 2", capacity: 30, type: "Laboratory" }
  ],
  courses: [
    { id: "c1", name: "DBMS", hours: 4, type: "Lecture" },
    { id: "c2", name: "OS", hours: 3, type: "Lecture" },
    { id: "c3", name: "Mathematics", hours: 4, type: "Lecture" },
    { id: "c4", name: "DBMS Lab", hours: 2, type: "Laboratory" },
    { id: "c5", name: "OS Lab", hours: 2, type: "Laboratory" }
  ],
  faculty: [
    { id: "sharma", name: "Prof. Sharma", department: "Computer Science", subjects: ["c1", "c4"] },
    { id: "gupta", name: "Prof. Gupta", department: "Computer Science", subjects: ["c2", "c5"] },
    { id: "math_prof", name: "Dr. Rao", department: "Mathematics", subjects: ["c3"] },
    { id: "admin", name: "Dr. Admin", department: "Administration", subjects: [] }
  ],
  batches: [
    { id: "b1", groupNumber: "2C4", department: "Computer Science", totalStudents: 60, subgroups: 2, subgroupNames: ["2C4-SG1", "2C4-SG2"] }
  ]
};

export const DEFAULT_FACULTY_DATA = {
  routine: [
    { id: "f1", day: "Monday", time: "08:00 - 09:00", subject: "DBMS", room: "204", section: "CSE-A", status: "cancelled" },
    { id: "f2", day: "Wednesday", time: "10:00 - 11:00", subject: "DBMS", room: "204", section: "CSE-A", status: "planned" },
    { id: "f3", day: "Friday", time: "14:00 - 15:00", subject: "DBMS Lab", room: "Lab 1", section: "CSE-A", status: "planned" }
  ],
  marketplace: [
    { id: "m1", title: "DBMS makeup", group: "CSE-A", type: "Lecture" },
    { id: "m2", title: "Tutorial", group: "CSE-B", type: "Tutorial" }
  ],
  preferences: {
    facultyId: "sharma",
    maxConsecutiveHours: 3,
    softUnavailableSlots: []
  }
};

export const DEFAULT_STUDENT_DATA = {
  routine: [
    { id: "t1", day: "Monday", time: "08:00 - 09:00", subject: "DBMS", room: "204", faculty: "Prof. Sharma", status: "cancelled", group: "CSE-A" },
    { id: "t2", day: "Monday", time: "09:00 - 10:00", subject: "FREE", room: "-", faculty: "-", status: "planned", group: "CSE-A" },
    { id: "t3", day: "Thursday", time: "10:00 - 11:00", subject: "Mathematics", room: "101", faculty: "Dr. Rao", status: "planned", group: "CSE-A" },
    { id: "t4", day: "Thursday", time: "11:00 - 12:00", subject: "OS", room: "205", faculty: "Prof. Gupta", status: "planned", group: "CSE-A" },
    { id: "t5", day: "Friday", time: "14:00 - 15:00", subject: "DBMS Lab", room: "Lab 1", faculty: "Prof. Sharma", status: "planned", group: "CSE-A" }
  ],
  polls: [
    { id: "p1", title: "DBMS Extra Lecture Slot Poll", options: ["Saturday 10:00 AM", "Monday 04:00 PM"], votes: [14, 8] }
  ]
};
