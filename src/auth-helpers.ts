import Hapi from '@hapi/hapi';
import Boom from '@hapi/boom';

export async function isTeacherOfCourseOrAdmin(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  // 👇 isAdmin and teacherOf are populated by the `validateAPIToken` function
  const { isAdmin, teacherOf } = request.auth.credentials;
  if (isAdmin) {
    // If the user is an admin allow
    return h.continue;
  }
  const courseId = parseInt(request.params.courseId, 10);
  // Verify that the authenticated user is a teacher of the requested course
  if (teacherOf?.includes(courseId)) {
    return h.continue;
  }
  // If the user is not a teacher of the course, deny access
  throw Boom.forbidden();
}
