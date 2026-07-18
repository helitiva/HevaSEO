// HevaSEO live E2E — feature-organized behavioral suite. Drives the REAL local Supabase stack (Auth +
// RLS + SECURITY DEFINER money/provisioning fns) across all 5 roles. Run against a pristine seed:
//   pnpm db:reset && docker restart supabase_kong_hevaseo-platform
//   J=$(pnpm exec supabase status -o json)
//   SMOKE_URL=http://127.0.0.1:54321 \
//   SMOKE_ANON=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).ANON_KEY))") \
//   SMOKE_SVC=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).SERVICE_ROLE_KEY))") \
//     node apps/app/scripts/e2e/run.mjs
import { login, ACCOUNTS, report } from './lib.mjs';
import { run as authRls } from './features/01-auth-rls.mjs';
import { run as ordersMoney } from './features/02-orders-money.mjs';
import { run as payoutsFinance } from './features/03-payouts-finance.mjs';
import { run as provisioning } from './features/04-provisioning-invite.mjs';
import { run as collabContent } from './features/05-collab-content.mjs';
import { run as affiliateSecurity } from './features/06-affiliate-security.mjs';
import { run as lifecycle } from './features/07-lifecycle.mjs';
import { run as revenuePayroll } from './features/08-revenue-payroll.mjs';

console.log('\n\x1b[1mHevaSEO — live E2E feature suite\x1b[0m (real Supabase Auth + RLS + money fns)');

const ctx = {
  admin: await login(ACCOUNTS.admin),
  manager: await login(ACCOUNTS.manager),
  staff: await login(ACCOUNTS.staff),
  customer: await login(ACCOUNTS.customer),
  affiliate: await login(ACCOUNTS.affiliate),
};

for (const feature of [authRls, ordersMoney, payoutsFinance, provisioning, collabContent, affiliateSecurity, lifecycle, revenuePayroll]) {
  await feature(ctx);
}

process.exit(report() ? 1 : 0);
