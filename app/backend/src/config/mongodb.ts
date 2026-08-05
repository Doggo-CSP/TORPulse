import { Db, MongoClient, ServerApiVersion } from 'mongodb'

import { env } from './env.js'

class MongoDatabase {
  private static instance: MongoDatabase | undefined

  private readonly client: MongoClient

  private database: Db | undefined

  private connectionPromise: Promise<Db> | undefined

  private constructor() {
    this.client = new MongoClient(env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    })
  }

  public static getInstance(): MongoDatabase {
    if (!MongoDatabase.instance) {
      MongoDatabase.instance = new MongoDatabase()
    }

    return MongoDatabase.instance
  }

  public async connect(): Promise<Db> {
    if (this.database) {
      return this.database
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.createConnection()
    }

    try {
      this.database = await this.connectionPromise
      return this.database
    } catch (error) {
      this.connectionPromise = undefined
      throw error
    }
  }

  private async createConnection(): Promise<Db> {
    await this.client.connect()

    const database = this.client.db(env.MONGODB_DATABASE)

    await database.command({ ping: 1 }) // Verify

    console.log(`MongoDB connected ${env.MONGODB_DATABASE}`)

    return database
  }

  public getDb(): Db {
    if (!this.database) {
      throw new Error('MongoDB is not connect call connect() before getDb()')
    }

    return this.database
  }

  public getClient(): MongoClient {
    return this.client
  }

  public async disconnect(): Promise<void> {
    await this.client.close()

    this.database = undefined

    this.connectionPromise = undefined

    console.log('MongoDB disconnected')
  }
}

export const mongodb = MongoDatabase.getInstance()
