'use client';

import { Component } from 'react';
import { AlertTriangle } from './icons';
import { Button } from './ui';

/**
 * Keeps a runtime error inside one pane (editor, preview, design panel) from
 * unmounting the whole application. The fallback offers a retry, which
 * re-mounts the children.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.name || 'ui'}] render failed`, error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{this.props.name ? `The ${this.props.name} hit an error.` : 'Something went wrong.'}</p>
          <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">{String(this.state.error?.message || this.state.error)}</p>
        </div>
        <Button size="sm" onClick={this.reset}>Try again</Button>
      </div>
    );
  }
}
