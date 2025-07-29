import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllAttendances = async (req, res) => {
  const attendances = await prisma.attendance.findMany();
  res.json(attendances);
};

export const getAttendanceById = async (req, res) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: BigInt(req.params.id) }
  });
  if (!attendance) return res.status(404).json({ error: 'Attendance not found' });
  res.json(attendance);
};

export const createAttendance = async (req, res) => {
  const { user_id, status, entry_time, exit_time, remarks, added_by } = req.body;
  const attendance = await prisma.attendance.create({
    data: { user_id, status, entry_time, exit_time, remarks, added_by: added_by ? BigInt(added_by) : null }
  });
  res.status(201).json(attendance);
};

export const updateAttendance = async (req, res) => {
  const { user_id, status, entry_time, exit_time, remarks, added_by } = req.body;
  const attendance = await prisma.attendance.update({
    where: { id: BigInt(req.params.id) },
    data: { user_id, status, entry_time, exit_time, remarks, added_by: added_by ? BigInt(added_by) : null }
  });
  res.json(attendance);
};

export const deleteAttendance = async (req, res) => {
  await prisma.attendance.delete({ where: { id: BigInt(req.params.id) } });
  res.json({ message: 'Attendance deleted' });
}; 