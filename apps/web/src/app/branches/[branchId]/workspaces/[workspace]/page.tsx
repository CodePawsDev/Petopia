import { Suspense } from "react";
import { notFound } from "next/navigation";
import WorkspaceView from "./workspace-view";

type RouteParams = {
  branchId: string;
  workspace: string;
};

export default function WorkspacePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Suspense
          fallback={
            <p
              role="status"
              className="rounded-3xl border border-border bg-surface p-8 text-muted"
            >
              กำลังโหลดพื้นที่ทำงาน…
            </p>
          }
        >
          <WorkspaceContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function WorkspaceContent({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { branchId, workspace } = await params;

  if (
    workspace !== "manager" &&
    workspace !== "groomer" &&
    workspace !== "payment"
  ) {
    notFound();
  }

  return (
    <WorkspaceView
      key={`${branchId}:${workspace}`}
      branchId={branchId}
      workspace={workspace}
    />
  );
}