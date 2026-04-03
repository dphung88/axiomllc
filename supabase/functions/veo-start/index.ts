// Vertex AI Veo — Start video generation
// Calls Vertex AI instead of Gemini Developer API → charges go to GCP billing (uses $300 credits)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Google Service Account → OAuth2 access token via JWT (RS256) */
async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const toB64Url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const header = toB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toB64Url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const sigInput = `${header}.${payload}`

  // Import RSA private key
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(sigInput),
  )

  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${sigInput}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const data = await res.json()
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const saJson = Deno.env.get('GOOGLE_SA_JSON')
    if (!saJson) throw new Error('GOOGLE_SA_JSON secret is not configured in Supabase.')

    const sa: Record<string, string> = (() => {
      let str = saJson.trim()
      if ((str.startsWith("'") && str.endsWith("'")) ||
          (str.startsWith('"') && str.endsWith('"'))) {
        str = str.slice(1, -1)
      }
      try {
        return JSON.parse(str)
      } catch (e) {
        throw new Error(`GOOGLE_SA_JSON invalid JSON. First 80 chars: [${str.substring(0, 80)}]. Err: ${e}`)
      }
    })()
    const projectId = sa.project_id
    const location = 'us-central1'

    const { prompt, image, aspectRatio = '16:9', model = 'veo-2.0-generate-001' } = await req.json()

    // Vertex AI uses different model IDs from the Gemini Developer API.
    // Map Gemini-API names → Vertex AI publisher model names.
    const VERTEX_MODEL_MAP: Record<string, string> = {
      'veo-3.1-fast-generate-preview': 'veo-3.0-generate-preview', // no "fast" variant on Vertex; use 3.0
      'veo-3-generate-preview':        'veo-3.0-generate-preview', // Vertex needs explicit ".0"
      'veo-3.0-generate-preview':      'veo-3.0-generate-preview',
      'veo-2.0-generate-001':          'veo-2.0-generate-001',
    }
    const vertexModel = VERTEX_MODEL_MAP[model] ?? 'veo-2.0-generate-001'

    const token = await getAccessToken(sa)

    // Build request body
    const instance: Record<string, unknown> = { prompt }
    if (image?.data) {
      instance.image = { bytesBase64Encoded: image.data, mimeType: image.mimeType || 'image/jpeg' }
    }

    const body = {
      instances: [instance],
      parameters: {
        aspectRatio,
        sampleCount: 1,
      },
    }

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}:predictLongRunning`

    const genRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const genData = await genRes.json()

    if (!genRes.ok) {
      throw new Error(`Vertex AI error (${genRes.status}): ${JSON.stringify(genData)}`)
    }

    if (!genData.name) {
      throw new Error(`No operation name returned: ${JSON.stringify(genData)}`)
    }

    return new Response(JSON.stringify({ operationName: genData.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
