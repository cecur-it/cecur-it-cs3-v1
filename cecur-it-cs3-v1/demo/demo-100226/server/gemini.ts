import { GoogleGenAI } from '@google/genai';
import { Incident } from '../src/types';
import { isLocalLLM, queryOllama } from './ai/ollama';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

function buildIncidentPrompt(incident: Incident): string {
  return `You are a Tier-3 Senior Cyber Defense Incident Commander at CECUR-IT SOC.
Analyze this correlated security incident and provide:
1. A concise 2-sentence executive triage summary.
2. MITRE ATT&CK breakdown and blast-radius evaluation.
3. 4 tactical containment and remediation playbook steps.

Incident Details:
- Title: ${incident.title}
- Severity: ${incident.severity}
- Category: ${incident.category}
- MITRE Tactic: ${incident.mitreTactic}
- MITRE Technique: ${incident.mitreTechnique}
- Affected Assets: ${incident.affectedAssets.join(', ')}
- Root Cause: ${incident.rootCause}

Respond in JSON format with keys:
{
  "aiSummary": "string",
  "mitreAnalysis": "string",
  "recommendedPlaybook": [
    {"step": 1, "title": "string", "actionType": "string"},
    {"step": 2, "title": "string", "actionType": "string"},
    {"step": 3, "title": "string", "actionType": "string"},
    {"step": 4, "title": "string", "actionType": "string"}
  ]
}`;
}

export async function generateIncidentAnalysisWithAI(incident: Incident): Promise<{
  aiSummary: string;
  mitreAnalysis: string;
  recommendedPlaybook: Array<{ step: number; title: string; actionType: string }>;
}> {
  const local = isLocalLLM();
  const ai = local ? null : getGenAI();

  if (local) {
    const raw = await queryOllama(buildIncidentPrompt(incident), 'You are a Tier-3 SOC Incident Commander.');
    try {
      const parsed = JSON.parse(raw);
      return {
        aiSummary: parsed.aiSummary || incident.aiSummary || 'Analysis generated.',
        mitreAnalysis: parsed.mitreAnalysis || `Mitre analysis for ${incident.mitreTactic}`,
        recommendedPlaybook: Array.isArray(parsed.recommendedPlaybook) ? parsed.recommendedPlaybook : incident.playbookSteps,
      };
    } catch {
      // fall through to heuristics
    }
  }

  if (!ai) {
    // Graceful offline heuristic generation
    return {
      aiSummary: `[Automated Heuristic Briefing] Incident ${incident.id} (${incident.title}) indicates active ${incident.mitreTactic}. Immediate containment of affected host assets (${incident.affectedAssets.join(', ')}) is recommended.`,
      mitreAnalysis: `Technique: ${incident.mitreTechnique}. High probability of credential re-use or secondary persistence in Active Directory subtree.`,
      recommendedPlaybook: [
        { step: 1, title: `Quarantine affected endpoints: ${incident.affectedAssets.slice(0, 2).join(', ')}`, actionType: 'quarantine' },
        { step: 2, title: 'Revoke and rotate active Kerberos tickets and session tokens', actionType: 'identity_reset' },
        { step: 3, title: 'Perform memory volatility dump and inspect injected processes', actionType: 'forensics' },
        { step: 4, title: 'Review SIEM telemetry for outbound C2 beacons', actionType: 'c2_sweep' },
      ],
    };
  }

  try {
    const prompt = buildIncidentPrompt(incident);


    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsed = JSON.parse(responseText);
    return {
      aiSummary: parsed.aiSummary || incident.aiSummary || 'Analysis generated.',
      mitreAnalysis: parsed.mitreAnalysis || `Mitre analysis for ${incident.mitreTactic}`,
      recommendedPlaybook: Array.isArray(parsed.recommendedPlaybook)
        ? parsed.recommendedPlaybook
        : incident.playbookSteps,
    };
  } catch (err: any) {
    console.warn('[CS3-AI] Analysis fallback:', err.message);
    return {
      aiSummary: `[Fallback Analysis] Critical security incident involving ${incident.affectedAssets.join(', ')}. Action required to contain lateral expansion.`,
      mitreAnalysis: `Targeted techniques: ${incident.mitreTechnique}`,
      recommendedPlaybook: incident.playbookSteps,
    };
  }
}
