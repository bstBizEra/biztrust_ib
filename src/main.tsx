import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/noto-sans-lao/400.css";
import "@fontsource/noto-sans-lao/600.css";
const CustomerApp = lazy(async () => {
  await import("./styles.css");
  return import("./App");
});
const OperationsApp = lazy(() => import("./OpsConsole"));
const isOperations =
  location.pathname === "/ops" || location.pathname.startsWith("/ops/");

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty-state">
        <h1>Let’s try that again.</h1>
        <p>
          We couldn’t display this page. Your submitted applications are safely
          stored.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload BizTrust
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Suspense
      fallback={
        <main className="startup-shell" role="status">
          Opening BizTrust…
        </main>
      }
    >
      {isOperations ? <OperationsApp /> : <CustomerApp />}
    </Suspense>
  </ErrorBoundary>,
);
