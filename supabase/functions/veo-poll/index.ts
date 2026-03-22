// Vertex AI Veo — Poll operation + download from GCS + upload to Supabase Storage
// Returns { done: false } while generating, { done: true, url: supabaseUrl } when complete

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

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

/** Extract GCS URI from Vertex AI operation response (multiple possible formats) */
function extractGcsUri(response: Record<string, unknown>): string {
  // Format 1: response.generateVideoResponse.generatedVideos[0].video.uri
  const f1 = (response?.generateVideoResponse as any)?.generatedVideos?.[0]?.video?.uri
  if (f1) return f1
  // Format 2: response.predictions[0].video.uri
  const f2 = (response?.predictions as any)?.[0]?.video?.uri
  if (f2) return f2
  // Format 3: response.predictions[0].videos[0].uri
  const f3 = (response?.predictions as any)?.[0]?.videos?.[0]?.uri
  if (f3) return f3
  // Format 4: response.videos[0].uri
  const f4 = (response?.videos as any)?.[0]?.uri
  if (f4) return f4
  // Format 5: response.generatedVideos[0].uri
  const f5 = (response?.generatedVideos as any)?.[0]?.uri
  if (f5) return f5
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const saJson = Deno.env.get('GOOGLE_SA_JSON')
    if (!saJson) throw new Error('GOOGLE_SA_JSON secret is not configured.')

    let jsonStr = saJson.trim()
    if ((jsonStr.startsWith("'") && jsonStr.endsWith("'")) ||
        (jsonStr.startsWith('"') && jsonStr.endsWith('"'))) {
      jsonStr = jsonStr.slice(1, -1)
    }
    let sa: Record<string, string>
    try {
      sa = JSON.parse(jsonStr)
    } catch (e) {
      throw new Error(`GOOGLE_SA_JSON invalid JSON. First 80 chars: [${saJson.substring(0, 80)}]. Err: ${e}`)
    }
    const { operationName } = await req.json()
    if (!operationName) throw new Error('operationName is required')

    const location = 'us-central1'
    const token = await getAccessToken(sa)

    // Check operation status
    const pollRes = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/${operationName}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    const pollData = await pollRes.json()

    if (!pollRes.ok) {
      throw new Error(`Poll error (${pollRes.status}): ${JSON.stringify(pollData)}`)
    }

    // Still running
    if (!pollData.done) {
      const meta = (pollData.metadata as any)
      const state = meta?.state || meta?.genericMetadata?.state || 'RUNNING'
      return new Response(JSON.stringify({ done: false, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for error in response
    if (pollData.error) {
      throw new Error(`Video generation failed: ${JSON.stringify(pollData.error)}`)
    }

    // Extract video GCS URI
    const gcsUri = extractGcsUri(pollData.response || {})
    if (!gcsUri) {
      throw new Error(`No video URI found in response: ${JSON.stringify(pollData.response)}`)
    }

    // Download from GCS using service account token
    // gs://bucket-name/path/to/file.mp4  →  bucket-name / path/to/file.mp4
    const withoutScheme = gcsUri.replace('gs://', '')
    const firstSlash = withoutScheme.indexOf('/')
    const bucket = withoutScheme.substring(0, firstSlash)
    const objectPath = withoutScheme.substring(firstSlash + 1)

    const downloadRes = await fetch(
      `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!downloadRes.ok) {
      const errText = await downloadRes.text()
      throw new Error(`GCS download failed (${downloadRes.status}): ${errText}`)
    }

    const videoBuffer = await downloadRes.arrayBuffer()

    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const filename = `videos/vertex-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`

    const { error: uploadError } = await supabase.storage
      .from('studio-media')
      .upload(filename, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) throw new Error(`Supabase upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('studio-media')
      .getPublicUrl(filename)

    return new Response(JSON.stringify({ done: true, url: publicUrl }), {
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
