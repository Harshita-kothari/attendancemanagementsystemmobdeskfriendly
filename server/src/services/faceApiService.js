import axios from 'axios'
import { env } from '../config/env.js'

const faceApi = axios.create({
  baseURL: env.faceApiUrl,
  timeout: 45000,
})

export async function registerFace(payload) {
  const response = await faceApi.post('/register-face', payload)
  return response.data
}

export async function recognizeFace(payload) {
  const response = await faceApi.post('/recognize-face', payload)
  return response.data
}
