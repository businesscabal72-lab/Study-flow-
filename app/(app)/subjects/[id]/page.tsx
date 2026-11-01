import { SubjectDetail } from "@/components/subjects/subject-detail";

export const metadata = { title: "Subject" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubjectDetail id={id} />;
}
