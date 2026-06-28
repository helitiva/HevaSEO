import { AUDIT } from '@/data/adminMock';
import { AuditView } from './AuditView';

export const metadata = { title: 'Audit log' };

export default function AuditPage() {
  return <AuditView source={AUDIT} />;
}
