import mongoose from 'mongoose';
import { env } from './env.js';

export async function initMongo() {
  await mongoose.connect(env.mongoUrl);
}
