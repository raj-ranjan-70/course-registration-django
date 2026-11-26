import api from './client';

/**
 * Generate a unique idempotency key for seat reservation requests.
 */
export function generateIdempotencyKey() {
  return 'key_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

/**
 * Unified Login using identifier (email, username, or registration number), password, and Turnstile token.
 */
export async function loginUser({ identifier, password, username, cf_turnstile_token }) {
  const loginIdentifier = identifier || username;
  const response = await api.post('/auth/login/', {
    username: loginIdentifier,
    password,
    cf_turnstile_token,
  });
  return response.data;
}

/**
 * Complete student profile after OAuth authentication.
 */
export async function completeProfile(profileData) {
  const response = await api.post('/auth/complete-profile/', profileData);
  return response.data;
}

/**
 * Student Login using Registration Number and Password or Email.
 */
export async function studentLogin({ registrationNumber, password, email }) {
  const payload = { registration_number: registrationNumber };
  if (password) payload.password = password;
  if (email) payload.email = email;
  const response = await api.post('/auth/student-login/', payload);
  return response.data;
}

/**
 * Student Registration.
 */
export async function studentRegister({ registrationNumber, email, password, name, degree, branch, semester, cgpa }) {
  const response = await api.post('/auth/student-register/', {
    registration_number: registrationNumber,
    email,
    password,
    name,
    degree,
    branch,
    semester,
    cgpa,
  });
  return response.data;
}

/**
 * Faculty Login using pre-seeded demo user IDs and passwords.
 */
export async function facultyLogin({ username, password }) {
  const response = await api.post('/auth/faculty-login/', {
    username,
    password,
  });
  return response.data;
}

/**
 * Get currently authenticated session user / profile.
 */
export async function getCurrentAuthUser(studentId = null) {
  const config = studentId ? { params: { student_id: studentId } } : {};
  const response = await api.get('/auth/me/', config);
  return response.data;
}

/**
 * Logout current user.
 */
export async function logoutUser() {
  const response = await api.post('/auth/logout/');
  return response.data;
}

/**
 * Update student profile attributes (Name, Degree, Branch, Semester, CGPA).
 */
export async function updateStudentProfile(data) {
  try {
    const response = await api.put('/auth/profile-update/', data);
    return response.data;
  } catch (err) {
    const response = await api.put('/students/me/', data);
    return response.data;
  }
}

/**
 * Fetch all elective groups (baskets) with nested courses and criteria.
 */
export async function getElectives(params = {}) {
  const response = await api.get('/electives/', { params });
  return response.data;
}

/**
 * Fetch unfinished elective drafts for faculty.
 */
export async function getElectiveDrafts() {
  const response = await api.get('/electives/', { params: { is_draft: 'true' } });
  return response.data;
}

/**
 * Fetch a single elective by ID (for restoring drafts or viewing details).
 */
export async function getElectiveById(id) {
  const response = await api.get(`/electives/${id}/`);
  return response.data;
}

/**
 * Step 1: Save basic info & schedule (Title, Description, Deadline, Term).
 */
export async function saveElectiveStep1(data) {
  const response = await api.post('/electives/save-step-1/', data);
  return response.data;
}

/**
 * Step 2: Save dynamic course list with individual seats and min CGPA.
 */
export async function saveElectiveStep2(id, data) {
  const response = await api.post(`/electives/${id}/save-step-2/`, data);
  return response.data;
}

/**
 * Step 3: Save whole-elective criteria and optionally finalize.
 */
export async function saveElectiveStep3(id, data) {
  const response = await api.post(`/electives/${id}/save-step-3/`, data);
  return response.data;
}

/**
 * Create a new elective group with title, description, required deadline,
 * whole-elective criteria (sem, degree, branch, CGPA), and individual courses.
 */
export async function createElectiveGroup(data) {
  const response = await api.post('/electives/', data);
  return response.data;
}

/**
 * Publish elective results (automatically executes matching algorithm before publishing).
 */
export async function publishElectiveGroup(id) {
  const response = await api.post(`/electives/${id}/publish/`);
  return response.data;
}

/**
 * Delete an elective group.
 */
export async function deleteElectiveGroup(id) {
  const response = await api.delete(`/electives/${id}/`);
  return response.data;
}

/**
 * Fetch the list of active courses with nested sections, schedules, and prerequisites.
 */
export async function getCourses(params = {}) {
  const response = await api.get('/courses/', { params });
  return response.data;
}

/**
 * Create a new elective course with flexible rules and default section capacity (Faculty Portal).
 */
export async function createCourse(courseData) {
  const response = await api.post('/courses/', courseData);
  return response.data;
}

/**
 * Update an existing elective course and rules (Faculty Portal).
 */
export async function updateCourse(courseId, courseData) {
  const response = await api.put(`/courses/${courseId}/`, courseData);
  return response.data;
}

/**
 * Delete a course.
 */
export async function deleteCourse(courseId) {
  const response = await api.delete(`/courses/${courseId}/`);
  return response.data;
}

/**
 * Fetch distinct departments for filtering.
 */
export async function getDepartments() {
  const response = await api.get('/courses/departments/');
  return response.data;
}

/**
 * Fetch the current student's profile, cohort window, and active registrations.
 */
export async function getCurrentStudent(studentId = null) {
  const config = studentId ? { params: { student_id: studentId } } : {};
  const response = await api.get('/students/me/', config);
  return response.data;
}

/**
 * Fetch list of all students to support demo persona switching in UI.
 */
export async function getStudents() {
  const response = await api.get('/students/');
  return response.data;
}

/**
 * Fetch precomputed eligibility snapshots for courses and sections.
 */
export async function getEligibilitySnapshots(studentId = null, courseId = null) {
  const params = {};
  if (studentId) params.student_id = studentId;
  if (courseId) params.course_id = courseId;
  const response = await api.get('/eligibility/', { params });
  return response.data;
}

/**
 * Register for a course section idempotently.
 */
export async function registerForSection({ sectionId, idempotencyKey = null, studentId = null }) {
  const key = idempotencyKey || generateIdempotencyKey();
  const payload = {
    section_id: sectionId,
    idempotency_key: key,
  };
  if (studentId) {
    payload.student_id = studentId;
  }

  const response = await api.post('/registrations/', payload, {
    headers: {
      'Idempotency-Key': key,
      ...(studentId ? { 'X-Student-Id': studentId } : {}),
    },
  });
  return response.data;
}

/**
 * Drop an active course registration and release the seat.
 */
export async function dropRegistration(registrationId, studentId = null) {
  const payload = studentId ? { student_id: studentId } : {};
  const response = await api.post(`/registrations/${registrationId}/drop/`, payload);
  return response.data;
}

/**
 * Add a section to cart (validates prerequisites and schedule clashes).
 */
export async function addToCart(sectionId, studentId = null) {
  const payload = { section_id: sectionId };
  if (studentId) payload.student_id = studentId;
  const response = await api.post('/cart/', payload);
  return response.data;
}

/**
 * Fetch the student's submitted elective preferences and latest match outcome.
 */
export async function getMyPreferences(studentId = null, term = 'Fall 2026') {
  const params = { term };
  if (studentId) params.student_id = studentId;
  const response = await api.get('/preferences/me/', { params });
  return response.data;
}

/**
 * Submit bulk ranked elective preferences.
 * Enforces faculty deadlines and max choice limits.
 */
export async function submitPreferences({ courseIds, term = 'Fall 2026', studentId = null }) {
  const payload = {
    course_ids: courseIds,
    term,
  };
  if (studentId) payload.student_id = studentId;
  const response = await api.post('/preferences/', payload);
  return response.data;
}

/**
 * Fetch student historical preferences and all past allocation results.
 */
export async function getPreferenceHistory(studentId = null) {
  const params = {};
  if (studentId) params.student_id = studentId;
  const response = await api.get('/preferences/history/', { params });
  return response.data;
}

/**
 * List all batch allocation runs for the admin/faculty dashboard.
 */
export async function getAllocationRuns() {
  const response = await api.get('/allocations/');
  return response.data;
}

/**
 * Retrieve detailed results and audit breakdown of a specific allocation run.
 */
export async function getAllocationRunDetail(runId) {
  const response = await api.get(`/allocations/${runId}/`);
  return response.data;
}

/**
 * Trigger Gale-Shapley batch allocation run.
 */
export async function triggerAllocationRun({ term = 'Fall 2026', seed = null, applyEnrollment = false }) {
  const payload = {
    term,
    apply_enrollment: applyEnrollment,
  };
  if (seed && seed.trim()) {
    payload.seed = seed.trim();
  }
  const response = await api.post('/allocations/run/', payload);
  return response.data;
}
