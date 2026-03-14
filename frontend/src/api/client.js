import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

const api = axios.create({ baseURL: BASE_URL })

export const getVendors       = ()      => api.get('/vendors/')
export const addVendor        = (data)  => api.post('/vendors/', data)
export const deleteVendor     = (id)    => api.delete(`/vendors/${id}`)
export const getVendorEvents  = (id)    => api.get(`/vendors/${id}/events`)
export const getScoreHistory  = (id)    => api.get(`/vendors/${id}/history`)
export const scanVendor       = (id)    => api.post(`/intelligence/scan/${id}`)
export const scanAll          = ()      => api.post('/intelligence/scan-all', {}, { timeout: 120000 })
export const exportPDF        = (id)    => api.get(`/export/${id}/pdf`, { responseType: 'blob' })