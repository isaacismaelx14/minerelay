import { redirect } from "next/navigation";
import { readServerBootstrapResult } from "@/admin/server/bootstrap.server";
import { OnboardingWizard } from "@/admin/features/onboarding/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { payload, authState } = await readServerBootstrapResult();

  if (authState === "unauthorized") {
    redirect("/login");
  }

  // If server is already configured, redirect to dashboard
  if (payload && !payload.needsOnboarding) {
    redirect("/");
  }

  return <OnboardingWizard />;
}
