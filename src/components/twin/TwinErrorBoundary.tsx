// COMMONS — error boundary for the 3D twin.
//
// If deck.gl throws at any point (init failure, WebGL context loss, layer error),
// componentDidCatch swaps to the provided fallback (the 2D choropleth). A class
// component is the only way to catch render-phase errors in React.
import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class TwinErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Surfaced to the console for diagnosis; the UI degrades silently to 2D.
    // eslint-disable-next-line no-console
    console.warn("[twin] 3D render failed, falling back to 2D:", error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
