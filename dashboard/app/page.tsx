export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 break-words">
              Emergency Services Crew Readiness Dashboard
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real-time workforce management platform with live staffing monitoring,
              event streaming, and Snowflake-powered analytics.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-bg opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="p-6 relative z-10">
                <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl">⚡</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Real-Time Monitoring</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Monitor shifts in real-time with WebSocket updates. See who's clocked in,
                  identify understaffed shifts, and receive instant alerts.
                </p>
              </div>
            </div>

            <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-bg-2 opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="p-6 relative z-10">
                <div className="w-12 h-12 gradient-bg-2 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Analytics & Insights</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Historical analytics powered by Snowflake. Track coverage patterns,
                  overtime risks, and attendance trends over time.
                </p>
              </div>
            </div>

            <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-bg-3 opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="p-6 relative z-10">
                <div className="w-12 h-12 gradient-bg-3 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl">🔄</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Event Streaming</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Built on Kafka (Confluent Cloud) for scalable event streaming.
                  Decoupled architecture enables future microservices.
                </p>
              </div>
            </div>

            <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-bg-4 opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="p-6 relative z-10">
                <div className="w-12 h-12 gradient-bg-4 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl">❄️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Data Warehouse</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Snowflake data warehouse with automated ETL via Streams & Tasks.
                  Pre-aggregated views for fast dashboard queries.
                </p>
              </div>
            </div>
          </div>

          {/* Tech Stack Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="mr-3">🛠️</span>
              Tech Stack
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Backend', value: 'FastAPI (Python) with WebSockets', icon: '⚙️' },
                { label: 'Frontend', value: 'Next.js 14 (TypeScript + React)', icon: '⚛️' },
                { label: 'Streaming', value: 'Kafka on Confluent Cloud', icon: '🌊' },
                { label: 'Data Warehouse', value: 'Snowflake with Streams & Tasks', icon: '❄️' },
                { label: 'Deployment', value: 'Render/Railway + Vercel', icon: '🚀' },
                { label: 'Real-time', value: 'WebSocket connections', icon: '🔌' },
              ].map((tech, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-4 rounded-xl hover:bg-indigo-50 transition-colors">
                  <span className="text-2xl">{tech.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{tech.label}</div>
                    <div className="text-sm text-gray-600">{tech.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-white animate-fade-in">
            <h3 className="text-2xl font-bold mb-4">Get Started</h3>
            <p className="text-indigo-100 mb-6">
              Start managing your workforce with real-time shift monitoring and analytics.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/shifts"
                className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-all transform hover:scale-105 shadow-lg"
              >
                View Live Shifts →
              </a>
              <a
                href="/analytics"
                className="bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-800 transition-all transform hover:scale-105 shadow-lg"
              >
                View Analytics →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

