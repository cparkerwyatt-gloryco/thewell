// GLORYCO | THE WELL — Vercel Edge Function (LLM-powered, JSON schema)
// File: /api/the-well.js

export const config = { runtime: 'edge' };

// ----------------- CORS + JSON helpers -----------------
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  };
}
function jsonResponse(obj, status = 200, origin = '*') {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin)
    }
  });
}

// ----------------- Schema instruction ------------------
const SCHEMA_PROMPT = `
Return ONLY JSON matching this schema:
{
  "response": string,                // main answer body
  "explanation": string|null,        // optional deeper dive
  "scripture_pathway": [             // list of passages used
    { "ref": string, "quote": string|null, "why": string|null,
      "translation": "ESV"|"CSB"|"NIV"|"NKJV" }
  ],
  "next_steps": string[],            // practical actions
  "reflection_prayer": string|null,  // short prayer (optional)
  "follow_up_question": string|null, // one inviting next question
  "intent": string                   // server-detected or model-assigned
}
Do not include markdown fences or extra text—JSON only.
`;

// ----------------- Optional: light intent tag (for UI) -----------------
function classifyIntentLight(q) {
  const s = (q || '').toLowerCase();
  if (/(suicide|kill myself|self[-\s]?harm|harm myself|overdose|i want to die|abuse|in danger)/i.test(s)) return 'crisis';
  if (/(did\s*jesus\s*rise|resurrection|minimal\s*facts|empty\s*tomb|habermas)/.test(s)) return 'resurrection';
  if (/(why\s+believe\s+(in\s+)?god|does\s+god\s+exist|fine[-\s]?tuning|moral\s+law|first\s*cause|atheis|agnosti)/.test(s)) return 'existence';
  if (/(problem\s+of\s+evil|suffering|why\s+bad\s+things)/.test(s)) return 'evil';
  if (/(bible|scripture).*(reliable|canon|manuscript|inerrant|inspiration|contradiction)/.test(s)) return 'bibliology';
  if (/(trinity|triune|three\s*in\s*one|godhead)/.test(s)) return 'trinity';
  if (/(who\s*is\s*jesus|is\s*jesus\s*god|incarnation|deity\s*of\s*christ)/.test(s)) return 'christology';
  if (/(salvation|saved|assurance|born again|eternal life)/.test(s)) return 'soteriology';
  return 'general';
}

// ----------------- Edge handler -----------------
export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405, origin);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400, origin);
  }

  const { query, mode = null, depth = 'deep', prompts = {}, config = {} } = body || {};
  if (!query || typeof query !== 'string') {
    return jsonResponse({ error: 'query required' }, 400, origin);
  }

  // crisis fast-path: still return LLM answer, but surface escalation flag
  const intent = classifyIntentLight(query);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // fallback if key missing (prevents blank UI)
    return jsonResponse({
      response: 'configuration error: missing OPENAI_API_KEY on server.',
      scripture_pathway: [{ ref: 'Psalm 119:105', why: 'the word lights our path', translation: 'ESV' }],
      next_steps: [],
      reflection_prayer: null,
      follow_up_question: null,
      intent
    }, 200, origin);
  }

  // Build SYSTEM + DEVELOPER + USER messages
  const system = (prompts.system || '').toString();
  const developer = (prompts.developer || '').toString();

  // Pass constraints from client config
  const translationOrder = Array.isArray(config.translationOrder) ? config.translationOrder.join(' → ') : 'ESV → CSB → NIV → NKJV';
  const xrefLimit = Number(config.xrefLimit || 5);
  const maxQuoteWords = Number(config.maxQuoteWords || 120);

  const constraints = `
- Quote from ${translationOrder}. Keep direct quotes ≤ ${maxQuoteWords} words.
- Use ≤ ${xrefLimit} cross-references unless the user requested /study.
- Format per mode:
  /ask → ≤120 words + one verse.
  /study → context → meaning → application → prayer.
  /pray → 2–5 sentence Christ-centered prayer.
  /plan → 7-day plan with passages + prompts.
  /debate → present biblical case, summarize opposing view fairly, respond charitably.
  /share → 4-slide caption (hook, scripture, insight, next step).
`;

  const userMsg = [
    `Question: ${query}`,
    `Mode: ${mode || 'none'}`,
    `Depth: ${depth}`,
    constraints,
    SCHEMA_PROMPT
  ].join('\n');

  // Call OpenAI-compatible API
  let rawText = '';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions?ts=' + Date.now(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        top_p: 0.9,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'system', content: developer },
          { role: 'user', content: userMsg }
        ]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return jsonResponse({ error: 'upstream', detail: errText }, 502, origin);
    }
    const out = await r.json();
    rawText = out?.choices?.[0]?.message?.content || '';
  } catch (e) {
    return jsonResponse({ error: 'model call failed', detail: String(e) }, 502, origin);
  }

  // Parse strict JSON; on failure, wrap raw text
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = {
      response: rawText,
      scripture_pathway: [],
      next_steps: [],
      reflection_prayer: null,
      follow_up_question: null,
      intent
    };
  }

  // Crisis escalation hint (non-blocking)
  if (intent === 'crisis') {
    payload.escalation = {
      type: 'crisis',
      message: 'if you are in immediate danger, contact local emergency services or dial 988 in the U.S.',
      contact_required: true
    };
  } else if (!payload.escalation) {
    payload.escalation = { type: 'none' };
  }

  // Default disclaimer if model didn’t include one
  if (!payload.disclaimer) {
    payload.disclaimer = 'this is guidance, not the final word—scripture is. read in context and walk with your local church.';
  }

  return jsonResponse(payload, 200, origin);
}

