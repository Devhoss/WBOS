const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const memberships = await p.organizationMembership.findMany({
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  console.log('Memberships:', JSON.stringify(memberships, null, 2));
  await p.$disconnect();
})();
