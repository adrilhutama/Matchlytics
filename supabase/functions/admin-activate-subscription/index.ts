// ---------------------------------------------------------------------------
// Supabase Edge Function: admin-activate-subscription
// ---------------------------------------------------------------------------
// Purpose:
//   Allows admin users (identified by a privileged JWT claim set at sign-in)
//   to change a subscriber's tier/status without SQL editor access.
//
// Security:
//   - ONLY callable by authenticated users whose email is in ADMIN_EMAILS
//   - Requires a POST body with: target_profile_id, tier, status, period_end
//   - Writes an audit log entry so every activation is traceable
//
// Usage from AdminDashboard frontend:
//   const resp = await supabase.functions.invoke('admin-activate-subscription', {
//     body: { target_profile_id, tier, status, period_end }
//   })
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAILS_ENV = Deno.env.get('ADMIN_EMAILS') || ''
const ADMIN_EMAILS = ADMIN_EMAILS_ENV.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, sb-raiserole',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  // ---- Auth check ----------------------------------------------------------
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY') || ''

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { authorization: authHeader } },
  })

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  const callerEmail = (user.email || '').toLowerCase()
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    console.warn(`Non-admin access attempt: ${callerEmail}`)
    return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  // ---- Body validation -----------------------------------------------------
  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  const { target_profile_id, tier, status, period_end } = body

  if (!target_profile_id) {
    return new Response(JSON.stringify({ error: 'target_profile_id is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  const validTiers = ['free', 'pro', 'annual', 'institutional']
  const validStatuses = ['inactive', 'active', 'past_due']
  if (!validTiers.includes(tier)) {
    return new Response(JSON.stringify({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }
  if (!validStatuses.includes(status)) {
    return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  // Validate period_end format if provided
  if (period_end) {
    const parsed = new Date(period_end)
    if (isNaN(parsed.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid period_end format' }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      })
    }
  }

  // ---- Execute update ------------------------------------------------------
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    subscription_tier: tier,
    subscription_status: status,
  }
  if (period_end) {
    updatePayload.current_period_end = period_end
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', target_profile_id)

  if (updateErr) {
    console.error('Profile update failed:', updateErr)
    return new Response(JSON.stringify({ error: 'Failed to update profile', details: updateErr.message }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  // ---- Audit log -----------------------------------------------------------
  const { error: auditErr } = await supabase
    .from('admin_audit_log')
    .insert({
      admin_email: callerEmail,
      action: status === 'active' ? 'activate_subscription' : 'deactivate_subscription',
      target_user_id: user.id,
      target_profile_id,
      details: { tier, status, period_end },
    })

  if (auditErr) {
    console.warn('Audit log insert failed (non-fatal):', auditErr)
  }

  return new Response(
    JSON.stringify({ success: true, tier, status, period_end }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    }
  )
})
