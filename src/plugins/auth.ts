import Boom from '@hapi/boom';
import Hapi from '@hapi/hapi';
import Joi from '@hapi/joi';
import jwt from 'jsonwebtoken';
import { TokenType, UserRole } from '@prisma/client';
import { add } from 'date-fns';

declare module '@hapi/hapi' {
  interface AuthCredentials {
    userId: number;
    tokenId: number;
    isAdmin: boolean;
    // 👇 The courseIds that a user is a teacher of, thereby granting him permissions to change entitites
    teacherOf: number[];
  }
}

const EMAIL_TOKEN_EXPIRATION_MINUTES = 10;

// Load the JWT secret from environment variables or default
const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_SECRET';
const JWT_ALGORITHM = 'HS256';
const AUTHENTICATION_TOKEN_EXPIRATION_HOURS = 12;

// This strategy will be used across the application to secure routes
export const API_AUTH_STATEGY = 'API';

interface LoginInput {
  email: string;
}

interface AuthenticateInput {
  email: string;
  emailToken: string;
}

interface APITokenPayload {
  tokenId: number;
}

// Generate a random 8 digit number as the email token
function generateEmailToken(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

const apiTokenSchema = Joi.object({
  tokenId: Joi.number().integer().required(),
});

// Generate a signed JWT token with the tokenId in the payload
function generateAuthToken(tokenId: number): string {
  const jwtPayload = { tokenId };
  return jwt.sign(jwtPayload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    noTimestamp: true,
  });
}

async function validateAPIToken(
  decoded: APITokenPayload,
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const { prisma } = request.server.app;
  const { tokenId } = decoded;
  const { error } = apiTokenSchema.validate(decoded);

  if (error) {
    request.log(['error', 'auth'], `API token error: ${error.message}`);
    return { isValid: false };
  }

  try {
    const fetchedToken = await prisma.token.findUnique({
      where: {
        id: tokenId,
      },
      include: {
        user: true,
      },
    });

    if (!fetchedToken || !fetchedToken?.valid) {
      return { isValid: false, errorMessage: 'Invalid Token' };
    }

    if (fetchedToken.expiration < new Date()) {
      return { isValid: false, errorMessage: 'Token expired' };
    }

    const teacherOf = await prisma.courseEnrollment.findMany({
      where: {
        userId: fetchedToken.userId,
        role: UserRole.TEACHER,
      },
      select: {
        courseId: true,
      },
    });

    return {
      isValid: true,
      credentials: {
        tokenId: decoded.tokenId,
        userId: fetchedToken.userId,
        isAdmin: fetchedToken.user.isAdmin,
        teacherOf: teacherOf.map(({ courseId }) => courseId),
      },
    };
  } catch (error) {
    request.log(['error', 'auth', 'db'], error);
    return { isValid: false };
  }
}

async function loginHandler(request: Hapi.Request, h: Hapi.ResponseToolkit) {
  const { prisma, sendEmailToken } = request.server.app;
  const { email } = request.payload as LoginInput;
  const emailToken = generateEmailToken();
  const tokenExpiration = add(new Date(), {
    minutes: EMAIL_TOKEN_EXPIRATION_MINUTES,
  });

  try {
    const createdToken = await prisma.token.create({
      data: {
        emailToken,
        type: TokenType.EMAIL,
        expiration: tokenExpiration,
        user: {
          connectOrCreate: {
            create: {
              email,
            },
            where: {
              email,
            },
          },
        },
      },
    });

    await sendEmailToken(email, emailToken);
    return h.response().code(200);
  } catch (error) {
    return Boom.badImplementation(error.message);
  }
}

async function authenticateHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const { prisma } = request.server.app;
  const { email, emailToken } = request.payload as AuthenticateInput;

  try {
    const fetchedEmailToken = await prisma.token.findUnique({
      where: {
        emailToken,
      },
      include: {
        user: true,
      },
    });

    if (!fetchedEmailToken?.valid) {
      return Boom.unauthorized();
    }

    if (fetchedEmailToken.expiration < new Date()) {
      return Boom.unauthorized('Token expired');
    }

    if (fetchedEmailToken?.user.email === email) {
      const tokenExpiration = add(new Date(), {
        hours: AUTHENTICATION_TOKEN_EXPIRATION_HOURS,
      });

      const createdToken = await prisma.token.create({
        data: {
          type: TokenType.API,
          expiration: tokenExpiration,
          user: {
            connect: {
              email,
            },
          },
        },
      });

      // invalidate email token
      await prisma.token.update({
        where: {
          id: fetchedEmailToken.id,
        },
        data: {
          valid: false,
        },
      });

      const authToken = generateAuthToken(createdToken.id);
      return h.response().code(200).header('Authorization', authToken);
    }
  } catch (error) {
    return Boom.badImplementation(error.message);
  }
}

const authPlugin: Hapi.Plugin<null> = {
  name: 'app/auth',
  dependencies: ['prisma', 'hapi-auth-jwt2', 'app/email'],
  register: async function (server: Hapi.Server) {
    // Define the authentication strategy which uses the `jwt` authentication scheme
    server.auth.strategy(API_AUTH_STATEGY, 'jwt', {
      key: JWT_SECRET,
      verifyOptions: { algorithms: [JWT_ALGORITHM] },
      validate: validateAPIToken,
    });

    // Set the default authentication strategy for API routes, unless explicitly disabled
    server.auth.default(API_AUTH_STATEGY);

    server.route([
      // Endpoint to login or register and to send the short-lived token
      {
        method: 'POST',
        path: '/login',
        handler: loginHandler,
        options: {
          auth: false,
          validate: {
            payload: Joi.object({
              email: Joi.string().email().required(),
            }),
          },
        },
      },
      {
        method: 'POST',
        path: '/authenticate',
        handler: authenticateHandler,
        options: {
          auth: false,
          validate: {
            payload: Joi.object({
              email: Joi.string().email().required(),
              emailToken: Joi.string().required(),
            }),
          },
        },
      },
    ]);
  },
};
export default authPlugin;
