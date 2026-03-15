import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://venderscope-api.onrender.com/api'

const api = axios.create({ baseURL: BASE_URL })

export const getVendors      = ()     => api.get('/vendors/')
export const addVendor       = (data) => api.post('/vendors/', data)
export const deleteVendor    = (id)   => api.delete(`/vendors/${id}`)
export const getVendorEvents = (id)   => api.get(`/vendors/${id}/events`)
export const getScoreHistory = (id)   => api.get(`/vendors/${id}/history`)

// force=true — always fetches fresh data, 90s timeout covers cold start + scan
export const scanVendor = (id) => api.post(`/intelligence/scan/${id}?force=true`, {}, { timeout: 90000 })

// force=false — uses 24hr cache, makes Scan All fast for recently scanned vendors
export const scanAll    = ()   => api.post('/intelligence/scan-all?force=false')

export const exportPDF  = (id) => api.get(`/export/${id}/pdf`, { responseType: 'blob' })