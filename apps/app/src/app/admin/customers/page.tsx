import { CUSTOMERS } from '@/data/adminMock';
import { CustomersClient } from './CustomersClient';
import { buildCustomerRows } from './rows';

export default function CustomersPage() {
  return <CustomersClient rows={buildCustomerRows(CUSTOMERS)} />;
}
