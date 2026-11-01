import { Suspense } from "react";
import { AssignmentsView } from "@/components/assignments/assignments-view";
export const metadata = { title: "Assignments" };
export default function Page() {
  return (
    <Suspense>
      <AssignmentsView />
    </Suspense>
  );
}
