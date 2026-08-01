import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const mode = process.argv[2];
const slug = process.env.BRADY_TEST_HOUSEHOLD_SLUG;
const emailA = process.env.BRADY_TEST_EMAIL_A;
const emailB = process.env.BRADY_TEST_EMAIL_B;
const passwordA = process.env.BRADY_TEST_PASSWORD_A;
const passwordB = process.env.BRADY_TEST_PASSWORD_B;

if (!slug?.startsWith('automated-brady-budget-')) {
  throw new Error('Refusing to touch a non-test Brady Budget household.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  if (mode === 'setup') {
    if (!emailA || !emailB || !passwordA || !passwordB) throw new Error('Two test credentials are required.');
    const passwordHashA = await bcrypt.hash(passwordA, 8);
    const passwordHashB = await bcrypt.hash(passwordB, 8);
    await sql.begin(async (transaction) => {
      await transaction`DELETE FROM mission_control.budget_households WHERE slug = ${slug}`;
      const [household] = await transaction`
        INSERT INTO mission_control.budget_households (slug, name)
        VALUES (${slug}, 'Automated Brady Budget test')
        RETURNING id
      `;
      await transaction`
        INSERT INTO mission_control.budget_users (household_id, email, display_name, password_hash)
        VALUES
          (${household.id}, ${emailA}, 'Phone One', ${passwordHashA}),
          (${household.id}, ${emailB}, 'Phone Two', ${passwordHashB})
      `;
    });
    console.log('Temporary household ready.');
  } else if (mode === 'cleanup') {
    await sql`DELETE FROM mission_control.budget_households WHERE slug = ${slug}`;
    console.log('Temporary household removed.');
  } else {
    throw new Error('Use setup or cleanup.');
  }
} finally {
  await sql.end();
}

