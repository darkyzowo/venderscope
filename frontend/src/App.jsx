import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import VendorDetail from './pages/VendorDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vendor/:id" element={<VendorDetail />} />
      </Routes>
    </BrowserRouter>
  )
}