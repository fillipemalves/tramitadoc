import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tramitadoc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || ''
    // Não desloga em rotas de validação de senha (sign) — erro 401 lá é senha errada, não token expirado
    const isSignRoute = url.includes('/sign')
    if (err.response?.status === 401 && !isSignRoute) {
      localStorage.removeItem('tramitadoc_token')
      localStorage.removeItem('tramitadoc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const authService = {
  login: (data) => api.post('/auth/login', data),
}

export const memoService = {
  list:        (params)              => api.get('/memos', { params }),
  getById:     (id)                  => api.get(`/memos/${id}`),
  create:      (data)                => api.post('/memos', data),
  update:      (id, data)            => api.put(`/memos/${id}`, data),
  deleteDraft: (id)                  => api.delete(`/memos/${id}`),
  sign:        (id, data)        => api.post(`/memos/${id}/sign`, data),
  send:        (id)              => api.post(`/memos/${id}/send`),
  receive:     (id, recipientId) => api.post(`/memos/${id}/receive`, { recipientId }),
  downloadPdf: (id)              => api.get(`/memos/${id}/pdf`, { responseType: 'blob', timeout: 60000 }),
}

export const deptService = {
  list:            (params)      => api.get('/departments', { params }),
  getById:         (id)          => api.get(`/departments/${id}`),
  create:          (data)        => api.post('/departments', data),
  update:          (id, data)    => api.put(`/departments/${id}`, data),
  delete:          (id)          => api.delete(`/departments/${id}`),
  removeWatermark: (id)          => api.delete(`/departments/${id}/watermark`),
  uploadWatermark: (id, file)    => {
    const form = new FormData()
    form.append('watermark', file)
    return api.post(`/departments/${id}/watermark`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const userService = {
  list:            (params)      => api.get('/users', { params }),
  getById:         (id)          => api.get(`/users/${id}`),
  create:          (data)        => api.post('/users', data),
  update:          (id, data)    => api.put(`/users/${id}`, data),
  delete:          (id)          => api.delete(`/users/${id}`),
  resetPwd:        (id)          => api.post(`/users/${id}/reset-password`),
  updateMyProfile: (data)        => api.patch('/users/me', data),
  changePassword:  (data)        => api.patch('/users/me/password', data),
}

export const secretaryService = {
  list:            (params)    => api.get('/secretaries', { params }),
  getById:         (id)        => api.get(`/secretaries/${id}`),
  create:          (data)      => api.post('/secretaries', data),
  update:          (id, data)  => api.put(`/secretaries/${id}`, data),
  delete:          (id)        => api.delete(`/secretaries/${id}`),
  removeWatermark: (id)        => api.delete(`/secretaries/${id}/watermark`),
  uploadWatermark: (id, file)  => {
    const form = new FormData()
    form.append('watermark', file)
    return api.post(`/secretaries/${id}/watermark`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
