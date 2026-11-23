import mongoose from 'mongoose';

const ChunkMetadataSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    chunkId: { type: String, required: true },
    filePath: { type: String, required: true },
    language: { type: String, required: true },
    symbol: { type: String, default: '' },
    symbolKind: { type: String, default: 'block' },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: 'chunk_metadata' }
);

ChunkMetadataSchema.index({ projectId: 1, filePath: 1 });

export const ChunkMetadata = mongoose.model('ChunkMetadata', ChunkMetadataSchema);
