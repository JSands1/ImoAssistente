import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import AuthGate from './components/AuthGate'
import './App.css'

function App() {
  if (window.location.pathname.startsWith('/painel')) return <AuthGate><Dashboard /></AuthGate>

  return <Landing />
}

export default App
