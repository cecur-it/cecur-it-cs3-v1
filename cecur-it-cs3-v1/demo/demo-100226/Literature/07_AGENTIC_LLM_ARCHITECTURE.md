# 07. Agentic LLM Architecture
## Dual-Agent Threat Reasoning, SOAR Playbook Generation, and Safety Rails

---

## 1. Architectural Philosophy

The CS3 Platform incorporates an **Agentic AI Architecture** designed to assist SOC analysts with high-speed incident triage, autonomous threat explanation, root cause analysis, and automated SOAR remediation script generation.

To guarantee zero operational downtime and eliminate single points of failure, the engine implements a **Dual-Agent + Deterministic Heuristic** tiered dispatch pipeline:

```
                                  [Incident Triage / Playbook Request]
                                                   |
                                                   v
                                       [queryDualAI Dispatcher]
                                                   |
                        +--------------------------+--------------------------+
                        |                                                     |
                        v (Try Primary)                                       v (Fallback)
         +-----------------------------+                       +-----------------------------+
         |          CS3 AGENT          |                       |       CECUR-IT AGENT        |
         |    (Gemini 3.7 Flash)       |                       |       (DeepSeek Chat)       |
         | - Model: gemini-3.7-flash   |                       | - Model: deepseek-chat      |
         | - Temp: 0.2                 |                       | - Temp: 0.2                 |
         | - JSON Schema Enforced      |                       | - JSON Output Enforced      |
         +--------------+--------------+                       +--------------+--------------+
                        | (Success)                                           | (Success)
                        +----------------------+       +----------------------+
                                               |       |
                                               v       v
                                    [Parsed Structured JSON]
                                               ^
                                               | (If Both Fail or Air-Gapped)
                                               |
                                 +-------------+---------------+
                                 |  RESILIENT LOCAL HEURISTICS |
                                 | - Deterministic MITRE Logic |
                                 | - Static Remediation Matrix |
                                 | - Zero External Dependencies|
                                 +-----------------------------+
```

---

## 2. Model Dispatcher Implementation (`server/ai/cecurAI.ts`)

### 2.1. Dual-Model Query Logic
```typescript
async function queryDualAI(prompt: string, systemInstruction: string): Promise<string> {
  const gemini = getGemini();

  // 1. Primary: CS3 Agent (Gemini 3.7 Flash)
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      if (response.text) return response.text;
    } catch (err: any) {
      console.warn('[Cecur AI] CS3 Agent encountered error, switching to CECUR-IT Agent:', err.message);
    }
  }

  // 2. Secondary: CECUR-IT Agent (DeepSeek Chat)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    try {
      const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemInstruction + '\nEnsure output is strictly valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (dsRes.ok) {
        const data = await dsRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err: any) {
      console.warn('[Cecur AI] CECUR-IT Agent failed:', err.message);
    }
  }

  throw new Error('All external LLM providers unavailable');
}
```

---

## 3. Agentic Capabilities

### 3.1. Incident Analysis & Root Cause Synthesis
* **Function**: `analyzeIncidentWithAI(incident)`
* **Output Schema**:
  ```typescript
  export interface AIIncidentAnalysis {
    summary: string;
    rootCause: string;
    impactAssessment: string;
    mitreTactic: string;
    mitreTechnique: string;
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidenceScore: number; // 0.0 - 1.0
    recommendedActions: string[];
    affectedSystems: string[];
    regulatoryImpact: string[];
  }
  ```

### 3.2. Automated SOAR Playbook Generation
* **Function**: `generateSOARPlaybook(incident)`
* **Output Schema**:
  ```typescript
  export interface SOARPlaybook {
    playbookId: string;
    title: string;
    estimatedExecutionTime: string;
    safetyChecks: string[];
    steps: {
      order: number;
      name: string;
      actionType: 'ISOLATE_HOST' | 'BLOCK_IP' | 'KILL_PROCESS' | 'REVOKE_TOKEN' | 'NOTIFY_TEAM';
      target: string;
      command: string;
      reversible: boolean;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    }[];
    rollbackProcedure: string;
  }
  ```

---

## 4. Operational Guardrails & Safety Constraints

1. **Strict Temperature Clamping**: Fixed at `temperature: 0.2` to eliminate creative hallucinations and enforce deterministic cybersecurity reasoning.
2. **Mandatory Rollback Procedures**: Every generated SOAR playbook **must** include an explicit, reversible rollback procedure prior to execution.
3. **Analyst-in-the-Loop Confirmation**: While the LLM synthesizes remediation commands, execution requires explicit authorization by an authenticated user with `analyst` or `admin` role clearance.
4. **Context Caching**: System prompts and MITRE matrix taxonomies are cached at the API gateway layer to decrease prompt token processing latency and reduce operational costs by up to 75%.
