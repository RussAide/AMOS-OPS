import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { TRPCProvider } from "./providers/trpc";
import { registerM52OfflineShell } from "./providers/m52-offline-shell";
import {
  initializeRuntimeConfig,
  runtimeConfig,
} from "./config/runtime";
import { RuntimeStartupLock } from "./components/runtime-startup-lock";
import App from "./App";
import "./index.css";

const router = createBrowserRouter([
  { path: "*", element: <App /> },
]);

function registerDemoOfflineSupport(): void {
  if (
    !import.meta.env.PROD ||
    runtimeConfig.mode !== "demo" ||
    typeof window === "undefined"
  ) {
    return;
  }
  const register = () => {
    void registerM52OfflineShell(
      "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    );
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

async function bootstrap(): Promise<void> {
  const root = createRoot(document.getElementById("root")!);
  try {
    await initializeRuntimeConfig();
  } catch (error) {
    console.error("AMOS runtime configuration verification failed", error);
    root.render(<RuntimeStartupLock />);
    return;
  }

  document.documentElement.dataset.amosRuntimeMode = runtimeConfig.mode;
  registerDemoOfflineSupport();
  root.render(
    <StrictMode>
      <TRPCProvider>
        <RouterProvider router={router} />
      </TRPCProvider>
    </StrictMode>,
  );
}

void bootstrap();
