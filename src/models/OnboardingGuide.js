import mongoose from 'mongoose';

const OnboardingGuideSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    overview: { type: String, default: '' },
    setupSteps: [{ type: String }],
    keyModules: [
      {
        filePath: String,
        purpose: String,
        centrality: Number,
      },
    ],
    readingOrder: [
      {
        step: Number,
        filePath: String,
        role: String,
        rationale: String,
      },
    ],
  },
  { timestamps: true, collection: 'onboarding_guides' }
);

export const OnboardingGuide = mongoose.model('OnboardingGuide', OnboardingGuideSchema);
