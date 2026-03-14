import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000/api' })

export const getVendors       = ()         => api.get('/vendors/')
export const addVendor        = (data)     => api.post('/vendors/', data)
export const deleteVendor     = (id)       => api.delete(`/vendors/${id}`)
export const getVendorEvents  = (id)       => api.get(`/vendors/${id}/events`)
export const getScoreHistory  = (id)       => api.get(`/vendors/${id}/history`)
export const scanVendor       = (id)       => api.post(`/intelligence/scan/${id}`)
export const scanAll          = ()         => api.post('/intelligence/scan-all')
export const exportPDF        = (id)       => api.get(`/export/pdf/${id}`, { responseType: 'blob' })
