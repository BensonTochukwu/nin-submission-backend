import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  await prisma.admin.upsert({
    where: { email: 'admin@nysc.local' },
    update: {
      name: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      passwordHash,
    },
    create: {
      name: 'Super Admin',
      email: 'admin@nysc.local',
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
