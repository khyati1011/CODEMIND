import mongoose from 'mongoose';

const SummarySchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    projectSummary: { type: String, default: '' },
    graph: {
      nodes: [
        {
          id: String,
          label: String,
          language: String,
          linesCount: Number,
          inDegree: Number,
          outDegree: Number,
          centrality: Number,
          isEntryPoint: Boolean,
        },
      ],
      edges: [
        {
          source: String,
          target: String,
        },
      ],
      rankings: [
        {
          filePath: String,
          score: Number,
          reason: String,
        },
      ],
    },
    fileTree: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'summaries' }
);

export const Summary = mongoose.model('Summary', SummarySchema);
