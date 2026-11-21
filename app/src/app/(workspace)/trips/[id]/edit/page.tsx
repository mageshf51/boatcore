import { RecordFormPage } from '../../../../../features/records/record-form-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordFormPage kind="trips" id={id} />;
}
