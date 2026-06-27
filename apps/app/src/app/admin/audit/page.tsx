import { AUDIT } from '@/data/adminMock';
import { AuditView } from './AuditView';

export default function AuditPage() {
  return <AuditView source={AUDIT} />;
}
