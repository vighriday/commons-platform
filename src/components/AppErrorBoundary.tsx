// COMMONS — the top-level error boundary.
//
// The last line of defence: if anything in the React tree throws during render,
// this catches it and shows a calm, branded recovery screen instead of a blank
// white page. A demo never dies to a white screen. A class component is the only
// way to catch render-phase errors in React.
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Surface to the console for diagnosis; the user sees the recovery screen.
    console.error("[commons] unhandled render error:", error);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface px-6 text-ink">
        <div className="max-w-sm text-center">
          <img src="/logo.png" width={40} height={40} alt="COMMONS" className="mx-auto" />
          <h1 className="mt-5 text-[18px] font-semibold">Something went wrong</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            COMMONS hit an unexpected error rendering this view. Your data is safe — reloading the
            page will restore it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg border border-line-strong bg-surface-overlay px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Reload COMMONS
          </button>
        </div>
      </div>
    );
  }
}
