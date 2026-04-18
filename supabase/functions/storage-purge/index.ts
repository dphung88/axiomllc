import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.11'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getR2Client() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')!
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
  const bucket = Deno.env.get('R2_BUCKET_NAME') || 'studio-media'
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  return { r2, endpoint }
}

async function deleteR2Keys(r2: AwsClient, endpoint: string, keys: string[]) {
  if (keys.length === 0) return
  // S3 Multi-Object Delete API
  const objects = keys.map(k => `<Object><Key>${k}</Key></Object>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Delete>${objects}</Delete>`
  const res = await r2.fetch(`${endpoint}?delete`, {
    method: 'POST',
    body: xml,
    headers: { 'Content-Type': 'application/xml' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 multi-delete failed (${res.status}): ${text}`)
  }
}

async function listR2Keys(r2: AwsClient, endpoint: string, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken = ''
  while (true) {
    const url = `${endpoint}?list-type=2&prefix=${encodeURIComponent(prefix)}${continuationToken ? `&continuation-token=${encodeURIComponent(continuationToken)}` : ''}`
    const res = await r2.fetch(url)
    if (!res.ok) throw new Error(`R2 list failed (${res.status})`)
    const xml = await res.text()
    // Extract <Key> values from XML
    const matches = xml.matchAll(/<Key>([^<]+)<\/Key>/g)
    for (const m of matches) keys.push(m[1])
    // Check for truncation
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    if (!truncated) break
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
    if (!tokenMatch) break
    continuationToken = tokenMatch[1]
  }
  return keys
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { r2, endpoint } = getR2Client()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    let body: any = {}
    try { body = await req.json() } catch { /* no body = purge all */ }

    // ── Single / multi path delete ──
    if (body.paths && Array.isArray(body.paths) && body.paths.length > 0) {
      await deleteR2Keys(r2, endpoint, body.paths)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Purge ALL mode ──
    const FOLDERS = ['videos', 'images', 'audio']
    const errors: string[] = []
    let totalDeleted = 0

    for (const folder of FOLDERS) {
      try {
        const keys = await listR2Keys(r2, endpoint, `${folder}/`)
        if (keys.length > 0) {
          await deleteR2Keys(r2, endpoint, keys)
          totalDeleted += keys.length
        }
      } catch (e: any) {
        errors.push(`${folder}: ${e.message}`)
      }
    }

    // Delete all DB records
    const { error: dbErr } = await supabase
      .from('studio_gallery')
      .delete()
      .gt('id', 0)

    if (dbErr) errors.push(`db: ${dbErr.message}`)

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        deletedFiles: totalDeleted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
