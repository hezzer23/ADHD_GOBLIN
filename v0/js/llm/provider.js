/* ═══════════════════════════════════════════════════════════════════════
   PROVIDER — lanțul LLM. DECISION: zero cheie în codul client.

   Ordine:
     1. BYOK (localStorage) — dacă userul și-a pus propria cheie, direct.
     2. Proxy /api/groq — cheia Groq trăiește pe Worker, zero config.

   Fiecare pas cade pe următorul la eroare. WebLLM local vine în ziua 5.
   ═══════════════════════════════════════════════════════════════════════ */
import { byokRequest, byokConfigured } from './byok.js';
import { groqRequest } from './groq.js';

export async function llmRequest(messages, opts = {}){
  /* 1. BYOK, dacă e configurat */
  if (byokConfigured()){
    try {
      return await byokRequest(messages, opts);
    } catch (err) {
      console.warn('[provider] BYOK fail, cad pe proxy Groq:', err.message);
    }
  }
  /* 2. proxy Groq (cheia pe server) */
  return groqRequest(messages, opts);
}
