import mongoose, { type Mongoose } from 'mongoose'

import { env } from './env.js'

class MongooseDatabase {
  private connectionPromise: Promise<Mongoose> | undefined

  public async connect(): Promise<Mongoose> {
    if (mongoose.connection.readyState === 1) {
      return mongoose
    }

    if (!this.connectionPromise) {
      this.connectionPromise = mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DATABASE,
        maxPoolSize: 20,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10_000,
      })
    }

    try {
      const connection = await this.connectionPromise

      if (!connection.connection.db) {
        throw new Error('Mongoose connected without an active database')
      }

      await connection.connection.db.admin().ping()
      console.log(`MongoDB connected ${env.MONGODB_DATABASE}`)

      return connection
    } catch (error) {
      this.connectionPromise = undefined
      throw error
    }
  }

  public async disconnect(): Promise<void> {
    await mongoose.disconnect()
    this.connectionPromise = undefined

    console.log('MongoDB disconnected')
  }
}

export const database = new MongooseDatabase()
