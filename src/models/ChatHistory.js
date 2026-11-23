import mongoose from 'mongoose';

const ChatHistorySchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    sources: [
      {
        filePath: String,
        startLine: Number,
        endLine: Number,
        symbol: String,
        score: Number,
        fromGraphNeighbor: Boolean,
      },
    ],
  },
  { timestamps: true, collection: 'chat_history' }
);

export const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
