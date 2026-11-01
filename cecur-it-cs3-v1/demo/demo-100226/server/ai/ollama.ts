import { getProfile } from '../profile';

export function isLocalLLM(): boolean {
  const mode = (process.env.CS3_LLM_MODE || '').toLowerCase();
  if (mode === 'local') return true;
  if (mode) return false;
  const profile = getProfile();
  return profile === 'onprem' || profile === 'airgap';
}

export function getOllamaConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, ''),
    primary: process.env.OLLAMA_PRIMARY_MODEL || 'nemotron-3-nano:30b',
    fallback: process.env.OLLAMA_FALLBACK_MODEL || 'gemma4:26b',
  };
}

/** Dispatch a chat completion to local Ollama (primary, then fallback model). Returns '' on failure. */
export async function queryOllama(prompt: string, systemInstruction: string): Promise<string> {
  const { baseUrl, primary, fallback } = getOllamaConfig();
  const models = [primary, fallback].filter((m, i, a) => m && a.indexOf(m) === i);
  for (const model of models) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction + '\nEnsure output is strictly valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          stream: false,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err: any) {
      console.warn(`[CS3-AI] Ollama model ${model} failed:`, err.message);
    }
  }
  return '';
}
