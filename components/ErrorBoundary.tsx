'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold text-red-600 mb-2">Oops! Algo deu errado</h1>
              <p className="text-gray-600 mb-6">
                Um erro inesperado ocorreu. Por favor, tente recarregar a página.
              </p>
              <details className="mb-6 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <summary className="cursor-pointer font-semibold">Detalhes do erro</summary>
                <pre className="mt-2 overflow-auto text-xs">{this.state.error?.toString()}</pre>
              </details>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Recarregar página
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
