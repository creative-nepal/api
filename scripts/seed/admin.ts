import { eq } from 'drizzle-orm';
import { auth } from '../../src/auth/auth.config';
import { getDb } from '../../src/database/client';
import { user } from '../../src/database/schema/auth';

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (see .env)',
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  const userId =
    existing?.id ??
    (
      await auth.api.signUpEmail({
        body: { email, password, name },
      })
    ).user.id;

  if (existing) {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password);

    if (await ctx.internalAdapter.findCredentialAccount(userId)) {
      await ctx.internalAdapter.updatePassword(userId, hashedPassword);
    } else {
      throw new Error(
        `User ${email} exists but has no credential (password) account — sign in with its existing provider or remove the user and re-run this script`,
      );
    }
  }

  await db.update(user).set({ role: 'admin' }).where(eq(user.id, userId));

  console.log(`Admin user ready: ${email} (role: admin)`);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
