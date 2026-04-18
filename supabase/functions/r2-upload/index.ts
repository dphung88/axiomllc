// Upload a file blob to Cloudflare R2, return permanent public URL
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.11'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accountId = Deno.env.get('R2_ACCOUNT_ID')!
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
    const bucket = Deno.env.get('R2_BUCKET_NAME') || 'studio-media'
    const publicUrl = Deno.env.get('R2_PUBLIC_URL')!

    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
      throw new Error('R2 environment variables not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL)')
    }

    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'video'
    const ext = url.searchParams.get('ext') || (type === 'video' ? 'mp4' : 'jpg')
    const contentType = req.headers.get('content-type') || (type === 'video' ? 'video/mp4' : 'image/jpeg')

    const key = `${type}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const body = await req.arrayBuffer()

    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })

    const uploadRes = await r2.fetch(
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
      { method: 'PUT', body, headers: { 'Content-Type': contentType } },
    )

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(`R2 upload failed (${uploadRes.status}): ${errText}`)
    }

    const base = publicUrl.replace(/\/$/, '')
    return new Response(
      JSON.stringify({ url: `${base}/${key}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
