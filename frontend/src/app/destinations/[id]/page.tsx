import { DestinationView } from "@/components/destination-view";

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DestinationView destinationId={id} />;
}
