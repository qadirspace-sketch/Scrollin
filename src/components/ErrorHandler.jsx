import React from 'react';

class ErrorHandler extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: '#ef4444', background: '#fee2e2', borderRadius: '8px', margin: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Something went wrong.</h4>
                    <p style={{ margin: 0, fontSize: '13px' }}>{this.state.error?.message || 'Unknown error'}</p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        style={{ marginTop: '10px', padding: '6px 12px', border: 'none', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorHandler;
