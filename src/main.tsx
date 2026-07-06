import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TRPCProvider } from '@/providers/trpc'
import { AuthProvider } from '@/hooks/useAuth'

/* ═══════════════════════════════════════════════════════════════
   CRASH RECOVERY — Runs before React mounts
   ═══════════════════════════════════════════════════════════════ */

const RESET_PARAM = 'resetamos'
const CRASH_KEY = 'amos_crash_count'
const CRASH_TS_KEY = 'amos_crash_ts'
const MAX_CRASHES = 2
const CRASH_WINDOW_MS = 30000 // 30 seconds

function runCrashRecovery(): boolean {
  const url = new URL(window.location.href)

  // 1. Manual reset: user visits URL with ?resetamos=true
  if (url.searchParams.get(RESET_PARAM) === 'true') {
    const cleared: string[] = []
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key) { localStorage.removeItem(key); cleared.push(key) }
    }
    sessionStorage.removeItem(CRASH_KEY)
    sessionStorage.removeItem(CRASH_TS_KEY)
    console.info('[AMOS-OPS] Manual reset complete. Cleared keys:', cleared)
    // Remove the param from URL so it doesn't loop
    url.searchParams.delete(RESET_PARAM)
    window.history.replaceState({}, '', url.toString())
    return true // signal that we recovered
  }

  // 2. Auto-recovery: if app has crashed multiple times in a short window,
  //    clear localStorage state (but NOT the auth token — we want them to re-login)
  try {
    const crashCount = parseInt(sessionStorage.getItem(CRASH_KEY) || '0', 10)
    const lastCrash = parseInt(sessionStorage.getItem(CRASH_TS_KEY) || '0', 10)
    const now = Date.now()

    if (crashCount >= MAX_CRASHES && (now - lastCrash) < CRASH_WINDOW_MS) {
      // Clear everything EXCEPT the token (let auth system handle that)
      const keysToPreserve = ['amos_token']
      const cleared: string[] = []
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && !keysToPreserve.includes(key)) {
          localStorage.removeItem(key)
          cleared.push(key)
        }
      }
      sessionStorage.removeItem(CRASH_KEY)
      sessionStorage.removeItem(CRASH_TS_KEY)
      console.info('[AMOS-OPS] Auto-recovery triggered. Cleared keys:', cleared)
      return true
    }
  } catch {
    // If sessionStorage itself is broken, fall through
  }

  return false
}

// Run recovery before anything else
const didRecover = runCrashRecovery()

/* ═══════════════════════════════════════════════════════════════
   MOUNT REACT
   ═══════════════════════════════════════════════════════════════ */

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found')
}

// Track crashes for auto-recovery
let hasMounted = false
const originalConsoleError = console.error
console.error = function (...args: any[]) {
  originalConsoleError.apply(console, args)
  // Detect React render errors
  const msg = args[0]?.toString?.() || ''
  if (msg.includes('Minified React error') || msg.includes('react') || msg.includes('undefined')) {
    const count = parseInt(sessionStorage.getItem(CRASH_KEY) || '0', 10) + 1
    sessionStorage.setItem(CRASH_KEY, String(count))
    sessionStorage.setItem(CRASH_TS_KEY, String(Date.now()))
  }
}

const root = createRoot(rootEl)

// Show recovery message if we just reset
if (didRecover) {
  rootEl.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#0a1628 0%,#0d1f35 100%);font-family:system-ui,sans-serif;">
      <div style="text-align:center;max-width:400px;padding:24px;">
        <img src="/assets/AMOS-OPS_Logo_Small.jpg" alt="AMOS-OPS" style="width:200px;margin:0 auto 20px;display:block;" />
        <p style="color:#7EC8CA;font-size:16px;font-weight:600;margin:0 0 8px;">Application Reset Complete</p>
        <p style="color:#8AB5B4;font-size:13px;line-height:1.5;margin:0 0 20px;">
          Your local session data has been cleared. The page will reload in 3 seconds...
        </p>
        <div style="width:40px;height:3px;background:#245C5A;border-radius:2px;margin:0 auto;animation:pulse 1s infinite;"></div>
      </div>
    </div>
    <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>
  `
  setTimeout(() => {
    window.location.reload()
  }, 3000)
} else {
  root.render(
    <StrictMode>
      <TRPCProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </TRPCProvider>
    </StrictMode>,
  )
}

hasMounted = true
