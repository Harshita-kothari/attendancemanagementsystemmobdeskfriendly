import axios from 'axios'
s
const defaultBaseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`
const storedBaseUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('fas_api_base') || defaultBaseUrl : defaultBaseUrl

const api = axios.create({
  baseURL: storedBaseUrl,
  timeout: 20000,
})

export function setApiBaseUrl(url) {
  api.defaults.baseURL = url
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('fas_api_base', url)
  }
}

export function getApiBaseUrl() {
  return api.defaults.baseURL
}

export default api
