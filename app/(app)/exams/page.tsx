import { Suspense } from "react";
import { ExamsView } from "@/components/exams/exams-view";
export const metadata = { title: "Exam Center" };
export default function Page() {
  return (
    <Suspense>
      <ExamsView />
    </Suspense>
  );
}
