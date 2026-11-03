import { Component, type ReactNode, type ErrorInfo } from "react";
import type { ClockLayoutProps } from "../../lib/themes/types";
import { DigitalLayout } from "./layouts/DigitalLayout";

interface ClockErrorBoundaryProps {
  clockProps: ClockLayoutProps;
  children: ReactNode;
}

interface ClockErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ClockErrorBoundary extends Component<
  ClockErrorBoundaryProps,
  ClockErrorBoundaryState
> {
  constructor(props: ClockErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ClockErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "[PomoPet ClockErrorBoundary] Clock render failed, falling back to DigitalLayout:",
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return <DigitalLayout {...this.props.clockProps} />;
    }
    return this.props.children;
  }
}
