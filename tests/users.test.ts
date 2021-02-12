import { createServer } from '../src/server';
import Hapi from '@hapi/hapi';
import { API_AUTH_STATEGY } from '../src/plugins/auth';
import { TokenType } from '@prisma/client';
import { add } from 'date-fns';

describe('POST /users - create user', () => {
  let server: Hapi.Server;
  beforeAll(async () => {
    server = await createServer();
  });
  afterAll(async () => {
    await server.stop();
  });
  let userId: number;

  test('create user', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/users',
      payload: {
        firstName: 'test-first-name',
        lastName: 'test-last-name',
        email: `test-${Date.now()}@prisma.io`,
        social: {
          twitter: 'thisisalice',
          website: 'https://www.thisisalice.com',
        },
      },
    });
    expect(response.statusCode).toEqual(201);
    userId = JSON.parse(response.payload)?.id;
    expect(typeof userId === 'number').toBeTruthy();
  });

  test('create user validation', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/users',
      payload: {
        lastName: 'test-last-name',
        email: `test-${Date.now()}@prisma.io`,
        social: {
          twitter: 'thisisalice',
          website: 'https://www.thisisalice.com',
        },
      },
    });
    expect(response.statusCode).toEqual(400);
  });

  test('get user returns 404 for non existant user', async () => {
    const response = await server.inject({ method: 'GET', url: '/users/9999' });
    expect(response.statusCode).toEqual(404);
  });

  test('get user returns user', async () => {
    const testUser = await server.app.prisma.user.create({
      data: {
        email: `test-${Date.now()}@test.com`,
        isAdmin: false,
        tokens: {
          create: {
            expiration: add(new Date(), { days: 7 }),
            type: TokenType.API,
          },
        },
      },
      include: {
        tokens: true,
      },
    });
    const testUserCredentials = {
      userId: testUser.id,
      tokenId: testUser.tokens[0].id,
      isAdmin: testUser.isAdmin,
      teacherOf: [], // empty array because no courses were created for the user
    };
    const response = await server.inject({
      method: 'GET',
      url: `/users/${testUserCredentials.userId}`,
      auth: {
        strategy: API_AUTH_STATEGY,
        credentials: testUserCredentials,
      },
    });
    expect(response.statusCode).toEqual(200);
    const user = JSON.parse(response.payload);
    expect(user.id).toBe(testUserCredentials.userId);
  });
  test('update user', async () => {
    const updatedFirstName = 'test-first-name-UPDATED';
    const updatedLastName = 'test-last-name-UPDATED';
    const response = await server.inject({
      method: 'PUT',
      url: `/users/${userId}`,
      payload: { firstName: updatedFirstName, lastName: updatedLastName },
    });
    expect(response.statusCode).toEqual(200);
    const user = JSON.parse(response.payload);
    expect(user.firstName).toEqual(updatedFirstName);
    expect(user.lastName).toEqual(updatedLastName);
  });

  test('delete user fails with invalid userId parameter', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: `/users/aa22`,
    });
    expect(response.statusCode).toEqual(400);
  });

  test('delete user', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: `/users/${userId}`,
    });
    expect(response.statusCode).toEqual(204);
  });
});
