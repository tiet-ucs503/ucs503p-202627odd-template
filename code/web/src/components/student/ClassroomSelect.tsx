'use client';

import React from 'react';
import { MenuItem, TextField } from '@mui/material';
import type { Classroom } from '@/lib/studentTypes';

export default function ClassroomSelect({
  classrooms,
  value,
  onChange,
  label = 'Classroom',
}: {
  classrooms: Classroom[];
  value: string;
  onChange: (classroomId: string) => void;
  label?: string;
}) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ mb: 2, bgcolor: '#fff', borderRadius: 1 }}
    >
      {classrooms.map((classroom) => (
        <MenuItem key={classroom.id} value={classroom.id}>
          {classroom.course_code}: {classroom.section_name}
        </MenuItem>
      ))}
    </TextField>
  );
}
