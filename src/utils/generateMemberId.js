const Counter = require('../models/Counter');

/**
 * Atomically generates the next sequential member ID for a student or teacher
 * Formats:
 *  - student: AIC-STU-001, AIC-STU-002, AIC-STU-003, ...
 *  - teacher: AIC-TEA-001, AIC-TEA-002, AIC-TEA-003, ...
 *
 * Uses MongoDB findByIdAndUpdate with $inc for atomic concurrency protection.
 *
 * @param {string} role - 'student' | 'teacher'
 * @returns {Promise<string>} Sequential Unique Member ID
 */
const generateNextMemberId = async (role) => {
  const normalizedRole = String(role).toLowerCase().trim();
  const isTeacher = normalizedRole === 'teacher';
  const prefix = isTeacher ? 'AIC-TEA' : 'AIC-STU';
  const counterId = isTeacher ? 'aic_teacher_seq' : 'aic_student_seq';

  // Atomic increment with MongoDB findByIdAndUpdate to prevent race conditions
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Pad to 3 digits (e.g. 001, 002, 003, ... 999, 1000)
  const formattedSequence = String(counter.seq).padStart(3, '0');
  return `${prefix}-${formattedSequence}`;
};

module.exports = generateNextMemberId;
