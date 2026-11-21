import { TripDetailsPage } from '../../../../features/trips/trip-details-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripDetailsPage id={id} />;
}
