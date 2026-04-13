import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase() {
  mongoose.set('strictQuery', true)
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 3000 })
    console.log('Connected to MongoDB:', env.mongoUri)
  } catch (error) {
    console.warn('Primary MongoDB unavailable, trying in-memory fallback...')
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const memoryServer = await MongoMemoryServer.create()
    const memoryUri = memoryServer.getUri()
    await mongoose.connect(memoryUri)
    console.log('Connected to in-memory MongoDB fallback:', memoryUri)
  }
}
