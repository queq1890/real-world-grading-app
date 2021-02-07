import Hapi from '@hapi/hapi';

import status from './plugins/status';
import prisma from './plugins/prisma';
import users from './plugins/users';

const server: Hapi.Server = Hapi.server({
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
});

export async function createServer(): Promise<Hapi.Server> {
  await server.register([prisma, status, users]);
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
