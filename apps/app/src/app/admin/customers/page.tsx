import { CUSTOMERS } from '@/data/adminMock';
import { CustomersClient } from './CustomersClient';
import { buildCustomerRows } from './rows';

export const metadata = { title: 'Customers' };

export default function CustomersPage() {
  return <CustomersClient rows={buildCustomerRows(CUSTOMERS)} />;
}
