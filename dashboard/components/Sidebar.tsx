'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Readiness', href: '/readiness' },
  { name: 'Personnel', href: '/personnel' },
  { name: 'Certificates', href: '/certifications-management' },
  { name: 'Shifts', href: '/shifts' },
  { name: 'Analytics', href: '/analytics' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isDashboardActive = pathname === '/'

  return (
    <div className="w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl flex flex-col h-screen">
      <div className="p-6 border-b border-gray-700">
      </div>
      
      {/* Dashboard Link - Separated at top */}
      <div className="px-3 pt-6 pb-4 border-b border-gray-700">
        <Link
          href="/"
          className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            isDashboardActive
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg'
              : 'hover:bg-gray-700'
          }`}
        >
          <span className="text-xl">🏠</span>
          <span className={`font-medium ${isDashboardActive ? 'text-white' : 'text-gray-300'}`}>
            Dashboard
          </span>
        </Link>
      </div>

      {/* Other Navigation Links */}
      <nav className="mt-4 px-3 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-3 mb-2 rounded-xl transition-all duration-200 border ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg border-indigo-500'
                  : 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600 hover:from-gray-700 hover:to-gray-600'
              }`}
            >
              <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
      <div className="p-6 border-t border-gray-700">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 border border-gray-600 shadow-lg">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400"></div>
            <span className="text-xs text-gray-300 font-medium">System Online</span>
          </div>
        </div>
      </div>
    </div>
  )
}

