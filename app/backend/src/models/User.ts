import { Schema, model, type Document } from 'mongoose'

export interface IUser extends Document {
  googleId: string
  name: string
  email: string
  image: string
}

const userSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  image: { type: String },
})

const User = model<IUser>('User', userSchema)

export default User
