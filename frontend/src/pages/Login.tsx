import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import { MessageSquare } from 'lucide-react'

// Auto-login for development - set VITE_DEV_AUTO_LOGIN=true in .env
const DEV_AUTO_LOGIN = import.meta.env.VITE_DEV_AUTO_LOGIN === 'true'
const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL || 'admin@autoversio.local'
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD || 'changeme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setToken, setAuth } = useAuthStore()

  // Auto-login in development mode
  useEffect(() => {
    if (DEV_AUTO_LOGIN) {
      const autoLogin = async () => {
        setLoading(true)
        try {
          const { access_token } = await api.auth.login(DEV_EMAIL, DEV_PASSWORD)
          setToken(access_token)
          const user = await api.auth.me()
          setAuth(access_token, user)
          navigate('/')
        } catch (err) {
          setError('Auto-login failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
          setLoading(false)
        }
      }
      autoLogin()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { access_token } = await api.auth.login(email, password)
      setToken(access_token)  // Save token first so api.auth.me() can use it
      const user = await api.auth.me()
      setAuth(access_token, user)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dark-700 mb-4">
            <MessageSquare className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">AutoVersio</h1>
          <p className="text-dark-400 mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="admin@autoversio.local"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
