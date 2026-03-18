import { Navigate, Route, Routes } from 'react-router-dom'
import PortfolioWorkflowPage from './pages/PortfolioWorkflowPage'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/portfolio?step=1" replace />} />
      <Route path="/portfolio" element={<PortfolioWorkflowPage />} />
      <Route path="*" element={<Navigate to="/portfolio?step=1" replace />} />
    </Routes>
  )
}

export default App
