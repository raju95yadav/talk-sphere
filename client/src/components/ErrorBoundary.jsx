import React, { Component } from 'react';
import clientLogger from '../utils/clientLogger';
import { ShieldAlert, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const moduleName = this.props.module || 'UNKNOWN_COMPONENT';
    this.setState({ errorInfo });
    clientLogger.error(`REACT_ERROR_BOUNDARY:${moduleName}`, `Component rendered crash in module: ${moduleName}`, error);
    console.error('React Error Boundary Info:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.module || 'APPLICATION_SECTION';
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-bg-card border border-red-500/20 rounded-3xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center max-w-md space-y-4">
            <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 animate-pulse">
              <ShieldAlert size={36} />
            </div>
            
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                MODULE DIAGNOSTIC: {moduleName}
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight text-text-main mt-3">
                SECTION RENDER FAILURE
              </h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed font-medium">
                An unexpected exception was caught in <code className="text-accent-primary bg-black/20 px-1.5 py-0.5 rounded font-mono">{moduleName}</code>.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-left overflow-x-auto max-h-32 custom-scrollbar">
                <p className="text-[10px] font-mono text-red-300 font-bold break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 bg-accent-primary text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
            >
              <RefreshCw size={14} /> RESTART SECTION
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
