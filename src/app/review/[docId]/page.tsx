import { redirect } from "next/navigation";

export default async function ReviewRedirect({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  redirect(`/document/${docId}`);
}
