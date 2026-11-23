import { generateCompletion } from '../assistant/index.js';
import { OnboardingGuide } from '../models/OnboardingGuide.js';
import { Summary } from '../models/Summary.js';

export async function generateOnboarding({ projectId, projectName, files, graphData, languageCounts }) {
  const manifestFiles = files.filter((f) =>
    ['package.json', 'requirements.txt', 'pyproject.toml', 'Dockerfile', 'docker-compose.yml', 'README.md'].some(
      (name) => f.path.endsWith(name)
    )
  );

  const manifestContext = manifestFiles
    .slice(0, 6)
    .map((f) => `### ${f.path}\n${f.content.slice(0, 1500)}`)
    .join('\n\n');

  const prompt = `Analyze the codebase metadata below and return strictly valid JSON (no markdown fences) with keys:
- "projectSummary": string (concise 2-sentence architectural summary)
- "overview": string (3-4 sentences explaining what the project does and how components interact)
- "setupSteps": array of strings (concrete installation and run commands inferred from manifests)
- "keyModules": array of { "filePath": string, "purpose": string, "centrality": number } (top 4-6 important files)
- "readingOrder": array of { "step": number, "filePath": string, "role": string, "rationale": string } (4-6 files in suggested onboarding order)

Project: ${projectName}
Languages: ${JSON.stringify(languageCounts)}
Graph Rankings (from Graphology): ${JSON.stringify(graphData.rankings, null, 2)}
File Paths (first 40):
${files.slice(0, 40).map((f) => f.path).join('\n')}

Manifests / README:
${manifestContext || 'None found'}`;

  const raw = await generateCompletion(
    prompt,
    'You are CODEMIND Onboarding Generator. Output strictly valid JSON matching the schema.'
  );

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json\s*|\s*```/g, '').trim());
  } catch {
    parsed = {
      projectSummary: `${projectName} codebase with ${files.length} scanned files.`,
      overview: raw.slice(0, 800),
      setupSteps: ['Review package.json or requirements.txt for dependency installation and start scripts.'],
      keyModules: graphData.rankings.slice(0, 5).map((r) => ({
        filePath: r.filePath,
        purpose: r.reason,
        centrality: r.score,
      })),
      readingOrder: graphData.rankings.slice(0, 5).map((r, i) => ({
        step: i + 1,
        filePath: r.filePath,
        role: i === 0 ? 'Entry Point' : 'Core Module',
        rationale: r.reason,
      })),
    };
  }

  const guideDoc = await OnboardingGuide.findOneAndUpdate(
    { projectId },
    {
      projectId,
      overview: parsed.overview || '',
      setupSteps: Array.isArray(parsed.setupSteps) ? parsed.setupSteps : [],
      keyModules: Array.isArray(parsed.keyModules) ? parsed.keyModules : [],
      readingOrder: Array.isArray(parsed.readingOrder) ? parsed.readingOrder : [],
    },
    { upsert: true, new: true }
  );

  await Summary.findOneAndUpdate(
    { projectId },
    { $set: { projectSummary: parsed.projectSummary || parsed.overview || '' } },
    { upsert: true }
  );

  return guideDoc;
}
