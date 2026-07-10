import { AuthProvider } from "@/hooks/use-auth";
import { HRProvider } from "@/context/hr-context";
import { NotificationProvider } from "@/context/notification-context";
import { OnboardingProvider } from "@/context/onboarding-context";
import { AppShell } from "@/components/shell/app-shell";

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HRProvider>
          <OnboardingProvider>
            <div className="min-h-screen bg-background">
              <AppShell />
            </div>
          </OnboardingProvider>
        </HRProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
