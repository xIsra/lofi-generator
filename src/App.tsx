import { lazy, Suspense } from "react";

const LofiGenerator = lazy(() => import("./components/lofi-generator"));

function Loader() {
  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-[#0a0a1a] font-comfortaa">
      <p className="font-light text-white/50">loading…</p>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loader />}>
      <LofiGenerator />
    </Suspense>
  );
}

export default App;
