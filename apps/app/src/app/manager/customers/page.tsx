import { PageHeader } from '@/components/shared/PageHeader';
import { CustomersClient } from '@/app/admin/customers/CustomersClient';
import { buildCustomerRows } from '@/app/admin/customers/rows';
import { managerScope, customersForPod, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager Customers — same client + derivation as admin, scoped to the customers
// this pod serves and money-blind (CustomersClient hides LTV/credit/AOV columns
// for the manager viewer).
export default function ManagerCustomersPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const rows = buildCustomerRows(customersForPod(scope));
  return (
    <section>
      <PageHeader title="Customers" subtitle={`${rows.length} customers served by your pod`} />
      <CustomersClient rows={rows} />
    </section>
  );
}
