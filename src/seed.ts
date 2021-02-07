import { PrismaClient } from '@prisma/client';
import { add } from 'date-fns';

const prisma = new PrismaClient();

// A `main` function so that we can use async/await
async function main() {
  const weekFromNow = add(new Date(), { days: 7 });
  const twoWeekFromNow = add(new Date(), { days: 14 });
  const monthFromNow = add(new Date(), { days: 28 });

  const grace = await prisma.user.create({
    data: {
      email: 'grace@hey.com',
      firstName: 'Grace',
      lastName: 'Bell',
      social: {
        facebook: 'gracebell',
        twitter: 'therealgracebell',
      },
    },
  });

  const course = await prisma.course.create({
    data: {
      name: 'CRUD with Prisma',
      tests: {
        create: [
          {
            date: weekFromNow,
            name: 'First test',
          },
          {
            date: twoWeekFromNow,
            name: 'Second test',
          },
          {
            date: monthFromNow,
            name: 'Final exam',
          },
        ],
      },
      members: {
        create: {
          role: 'TEACHER',
          user: {
            connect: {
              email: 'grace@hey.com',
            },
          },
        },
      },
    },
    // include relations in the result
    include: {
      tests: true,
    },
  });

  const shakuntala = await prisma.user.create({
    data: {
      email: 'devi@prisma.io',
      firstName: 'Shakuntala',
      lastName: 'Devi',
      courses: {
        create: {
          role: 'STUDENT',
          course: {
            connect: {
              id: grace.id,
            },
          },
        },
      },
    },
  });
  const david = await prisma.user.create({
    data: {
      email: 'david@prisma.io',
      firstName: 'David',
      lastName: 'Deutsch',
      courses: {
        create: {
          role: 'STUDENT',
          course: {
            connect: { id: course.id },
          },
        },
      },
    },
  });

  // await prisma.testResult.create({
  //   data: {
  //     gradedBy: {
  //       connect: { email: grace.email },
  //     },
  //     student: {
  //       connect: { email: shakuntala.email },
  //     },
  //     test: {
  //       connect: { id: test.id },
  //     },
  //     result: 950,
  //   },
  // });
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Disconnect Prisma Client
    await prisma.$disconnect();
  });
