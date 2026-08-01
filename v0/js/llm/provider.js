/* ═══════════════════════════════════════════════════════════════════════
   PROVIDER — chain: groq → byok → webllm. Ziua 2: doar groq.
   Fallback-ul automat vine în ziua 5.
   ═══════════════════════════════════════════════════════════════════════ */
import { groqRequest } from './groq.js';

export async function llmRequest(messages, opts = {}){
  /* ziua 5: try groq → catch → byok → catch → webllm */
  return groqRequest(messages, opts);
}
