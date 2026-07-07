// redeploy trigger 
import { AuthProvider } from "@/hooks/use-auth";
import { AppShell } from "@/components/shell/app-shell";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <AppShell />
      </div>
    </AuthProvider>
  );
}
