/* ═══════════════════════════════════════════════════════════════════════
   GROQ — prin proxy-ul Cloudflare (/api/groq). Cheia e pe server,
   nu în client. Zero config pentru testeri: doar trimite messages.
   ═══════════════════════════════════════════════════════════════════════ */

export async function groqRequest(messages, { json = true, maxTokens } = {}){
  const res = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, json, max_tokens: maxTokens }),
  });

  if (!res.ok){
    const txt = await res.text().catch(() => '');
    throw new Error(`PROXY_${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
