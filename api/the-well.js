// GLORYCO | THE WELL — Vercel Edge Function (single-file + CORS)
// File path in your repo: /api/the-well.js
// Purpose: Responds to POST requests from the Squarespace embed with
// a scripture-first, guardrailed JSON payload.

export const config = { runtime: 'edge' };

// ----------------- CORS -----------------
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
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

// -------------- Shared logic --------------
function classifyIntent(q) {
  const s = (q || '').toLowerCase();
  const crisis = /(suicide|kill myself|self[-\s]?harm|harm myself|overdose|i want to die|abuse|in danger)/i.test(s);
  if (crisis) return { key: 'crisis' };
  if (/(assurance|saved|salvation|born again|eternal life|how do i know)/.test(s)) return { key: 'assurance' };
  if (/(pray|prayer|how to pray|teach us to pray|lord's prayer)/.test(s)) return { key: 'prayer' };
  if (/(anxiety|worry|fear|panic|anxious)/.test(s)) return { key: 'anxiety' };
  if (/(dating|purity|sexual|lust|porn)/.test(s)) return { key: 'purity' };
  if (/(suffering|why god|pain|hurt|loss|grief)/.test(s)) return { key: 'suffering' };
  return { key: 'general' };
}

const APPROVED_RESOURCES = [
  { id: 'sproul_holiness_of_god', title: 'The Holiness of God', author: 'R. C. Sproul', topics: ['attributes_of_God', 'holiness'] },
  { id: 'wilkin_women_word', title: 'Women of the Word', author: 'Jen Wilkin', topics: ['bible_study', 'discipleship'] },
  { id: 'keller_reason_for_god', title: 'The Reason for God', author: 'Tim Keller', topics: ['apologetics', 'doubt'] },
  { id: 'piper_desiring_god', title: 'Desiring God', author: 'John Piper', topics: ['joy', 'purpose', 'worship'] },
  { id: 'deyoung_hole_in_holiness', title: 'The Hole in Our Holiness', author: 'Kevin DeYoung', topics: ['sanctification'] }
];

function pickResource(intentKey) {
  const topicMap = {
    assurance: ['gospel', 'assurance', 'holiness'],
    prayer: ['bible_study', 'discipleship'],
    anxiety: ['trust', 'suffering'],
    purity: ['sanctification'],
    suffering: ['suffering', 'holiness'],
    general: ['bible_study', 'worship']
  };
  const topics = topicMap[intentKey] || ['bible_study'];
  return APPROVED_RESOURCES.find(r => r.topics.some(t => topics.includes(t))) || APPROVED_RESOURCES[0];
}

const DISCLAIMER = 'this is guidance, not the final word—scripture is. read in context and talk with your local church.';
const CRISIS_MESSAGE = 'if you’re in immediate danger, please contact local emergency services or your national crisis line now.';

function buildPayload(intentKey) {
  if (intentKey === 'crisis') {
    const rec = pickResource('suffering');
    return {
      summary: 'i’m really sorry you’re carrying this. your life is precious to God, and you are not alone. there is help available right now.',
      scripture_pathway: [
        { ref: 'Psalm 34:17-18', why: 'the Lord is near to the brokenhearted', translation: 'ESV' },
        { ref: 'Matthew 11:28-30', why: 'jesus invites the weary to find rest', translation: 'ESV' }
      ],
      recommendation: { resource_id: rec.id, title: rec.title, author: rec.author },
      next_steps: ['tell someone you trust today', 'pray with psalm 61'],
      disclaimer: DISCLAIMER,
      escalation: { type: 'crisis', message: CRISIS_MESSAGE, contact_required: true }
    };
  }

  const map = {
    assurance: {
      summary: 'assurance rests in christ’s finished work, not our shifting feelings. those who trust him bear the spirit’s witness and growing obedience.',
      passages: [
        { ref: 'John 10:27-30', why: 'jesus holds his sheep securely', translation: 'ESV' },
        { ref: 'Romans 8:31-39', why: 'nothing separates us from god’s love in christ', translation: 'ESV' },
        { ref: '1 John 5:11-13', why: 'you may know you have eternal life', translation: 'ESV' }
      ],
      steps: ['pray through romans 8', 'share with a mentor what you read']
    },
    prayer: {
      summary: 'prayer grows as we approach the father through the son by the spirit. scripture shapes our words and desires as we ask according to his will.',
      passages: [
        { ref: 'Matthew 6:5-13', why: 'jesus teaches a pattern for prayer', translation: 'ESV' },
        { ref: 'Philippians 4:6-7', why: 'bring everything to god with thanksgiving', translation: 'ESV' },
        { ref: 'Romans 8:26-27', why: 'the spirit helps in our weakness', translation: 'ESV' }
      ],
      steps: ['pray the lord’s prayer slowly', 'write one request and one thanksgiving']
    },
    anxiety: {
      summary: 'god invites the anxious to cast their cares on him. his presence and promises steady our hearts even when circumstances remain hard.',
      passages: [
        { ref: 'Matthew 6:25-34', why: 'the father knows your needs', translation: 'ESV' },
        { ref: '1 Peter 5:6-7', why: 'cast your anxieties on him', translation: 'ESV' },
        { ref: 'Psalm 34:4-8', why: 'he hears and delivers', translation: 'ESV' }
      ],
      steps: ['memorize 1 peter 5:7', 'share a burden with your small group']
    },
    purity: {
      summary: 'christ calls us to holiness and offers power to fight sin. we turn from lust by turning to a greater love and walking in the light with others.',
      passages: [
        { ref: '1 Thessalonians 4:3-8', why: 'god’s will is your sanctification', translation: 'ESV' },
        { ref: '1 Corinthians 6:18-20', why: 'you were bought with a price', translation: 'ESV' },
        { ref: 'Galatians 5:16-24', why: 'walk by the spirit to bear his fruit', translation: 'ESV' }
      ],
      steps: ['confess to a trusted believer', 'set one concrete guardrail this week']
    },
    suffering: {
      summary: 'in suffering, god has not abandoned you. in christ, he meets you, sustains you, and works for your eternal good and his glory.',
      passages: [
        { ref: 'Romans 8:18-28', why: 'present sufferings vs. future glory', translation: 'ESV' },
        { ref: '2 Corinthians 4:16-18', why: 'eternal weight of glory', translation: 'ESV' },
        { ref: '1 Peter 1:3-9', why: 'tested faith, living hope', translation: 'ESV' }
      ],
      steps: ['pray with a friend this week', 'meditate on 2 corinthians 4:17']
    },
    general: {
      summary: 'scripture is the clearest place to start. here are passages that ground us in the gospel and a life with god.',
      passages: [
        { ref: 'John 3:16-21', why: 'god’s love and the call to believe', translation: 'ESV' },
        { ref: 'Ephesians 2:1-10', why: 'saved by grace through faith', translation: 'ESV' },
        { ref: 'Psalm 119:105', why: 'the word lights our path', translation: 'ESV' }
      ],
      steps: ['read one passage aloud', 'ask the spirit for understanding']
    }
  };

  const m = map[intentKey] || map.general;
  const rec = pickResource(intentKey);
  return {
    summary: m.summary,
    scripture_pathway: m.passages,
    recommendation: { resource_id: rec.id, title: rec.title, author: rec.author },
    next_steps: m.steps,
    disclaimer: DISCLAIMER,
    escalation: { type: 'none' }
  };
}

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

  const { query } = body || {};
  if (!query || typeof query !== 'string') {
    return jsonResponse({ error: 'query required' }, 400, origin);
  }

  const intent = classifyIntent(query);
  const payload = buildPayload(intent.key);
  return jsonResponse(payload, 200, origin);
}
