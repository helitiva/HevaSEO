import { CustomerDetailView } from './view';

export const metadata = { title: 'Customer' };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetailView id={id} />;
}
