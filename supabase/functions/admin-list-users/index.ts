// ---------------------------------------------------------------------------
// Supabase Edge Function: admin-list-users
// ---------------------------------------------------------------------------
// Purpose:
//   Returns a list of all user profiles for the admin panel.
//   Uses the service role to bypass RLS so admins can see all users.
//
// Security:
//   - ONLY callable by authenticated users whose email is in ADMIN_EMAILS
//   - Returns profile data (no auth secrets)
//
// Usage from AdminPanel frontend:
//   const { data, error } = await supabase.functions.invoke('admin-list-users')
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
        'Access-Control-Allow-Headers': 'authorization, content-type',
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
    console.warn(`Non-admin access attempt to admin-list-users: ${callerEmail}`)
    return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  // ---- Fetch all profiles (service role bypasses RLS) ----------------------
  const { data: profiles, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, subscription_tier, subscription_status, current_period_end, created_at, is_admin')
    .order('created_at', { ascending: false })

  if (fetchErr) {
    console.error('Failed to fetch profiles:', fetchErr)
    return new Response(JSON.stringify({ error: 'Failed to fetch users', details: fetchErr.message }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    })
  }

  return new Response(
    JSON.stringify({ users: profiles || [] }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    }
  )
})
