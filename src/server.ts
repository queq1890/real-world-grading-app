import Hapi from '@hapi/hapi';

// plugins
import hapiAuthJWT from 'hapi-auth-jwt2';

// self defined plugins
import status from './plugins/status';
import prisma from './plugins/prisma';
import email from './plugins/email';
import users from './plugins/users';
import usersEnrollment from './plugins/users-enrollment';
import courses from './plugins/courses';
import testResults from './plugins/test-results';
import auth from './plugins/auth';

const server: Hapi.Server = Hapi.server({
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
});

export async function createServer(): Promise<Hapi.Server> {
  await server.register([
    prisma,
    hapiAuthJWT,
    email,
    auth,
    status,
    users,
    usersEnrollment,
    testResults,
    courses,
  ]);
  await server.initialize();
  return server;
}

export async function startServer(server: Hapi.Server): Promise<Hapi.Server> {
  await server.start();
  console.log(`Server running on ${server.info.uri}`);
  return server;
}
process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

export async function start(): Promise<Hapi.Server> {
  const server = await createServer();
  return await startServer(server);
}
