import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_KEY = Deno.env.get('SONICPESA_API_KEY') || '';
const SECRET_KEY = Deno.env.get('SONICPESA_SECRET_KEY') || '';
const BASE_URL = 'https://api.sonicpesa.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get authenticated user
  const authHeader = req.headers.get('Authorization') || '';
  let userId: string | null = null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // ─── CREATE ORDER ───────────────────────────────────────────────
    if (action === 'create') {
      const body = await req.json();
      const { phone, amount, plan, buyer_name } = body;

      if (!phone || !amount || !plan) {
        return new Response(JSON.stringify({ success: false, message: 'Tafadhali jaza namba ya simu na mpango' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
      }

      // Format phone → 255XXXXXXXXX
      let ph = phone.trim().replace(/\s+/g, '');
      if (ph.startsWith('+')) ph = ph.slice(1);
      if (ph.startsWith('0')) ph = '255' + ph.slice(1);

      const payload = {
        buyer_email: `${ph}@chtv.app`,
        buyer_name: buyer_name || 'Customer',
        buyer_phone: ph,
        amount: parseInt(amount),
        currency: 'TZS',
      };

      console.log('Creating order:', JSON.stringify(payload));

      const res = await fetch(`${BASE_URL}/payment/create_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'X-SECRET-KEY': SECRET_KEY,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      console.log('SonicPesa create response:', res.status, responseText);

      let data: any = {};
      try { data = JSON.parse(responseText); } catch { /* ignore */ }

      if (res.ok && (data.status === 'success' || data.order_id)) {
        const orderId = data.data?.order_id || data.order_id;

        // Calculate expiry
        const now = new Date();
        const expiresAt = new Date(now);
        if (plan === 'day') expiresAt.setDate(now.getDate() + 1);
        else if (plan === 'week') expiresAt.setDate(now.getDate() + 7);
        else if (plan === 'week2') expiresAt.setDate(now.getDate() + 14);
        else if (plan === 'month') expiresAt.setMonth(now.getMonth() + 1);

        // Save subscription as pending
        if (userId) {
          const { error: subErr } = await supabase.from('subscriptions').insert({
            user_id: userId,
            plan,
            amount: parseInt(amount),
            status: 'pending',
            order_id: orderId,
            phone: ph,
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
          if (subErr) console.error('Subscription insert error:', subErr);
        }

        return new Response(JSON.stringify({ success: true, order_id: orderId, message: 'Ombi la malipo limetumwa kwa simu yako' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: data.message || `Hitilafu: ${responseText}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
      }

    // ─── CHECK STATUS ────────────────────────────────────────────────
    } else if (action === 'status') {
      const orderId = url.searchParams.get('order_id');
      if (!orderId) return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      });

      const res = await fetch(`${BASE_URL}/payment/order_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'X-SECRET-KEY': SECRET_KEY,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const responseText = await res.text();
      console.log('SonicPesa status response:', res.status, responseText);

      let data: any = {};
      try { data = JSON.parse(responseText); } catch { /* ignore */ }

      if (res.ok && data.status === 'success') {
        const rawStatus = data.data?.payment_status || data.payment_status || 'PENDING';
        let frontendStatus = 'PENDING';
        if (rawStatus === 'COMPLETED') frontendStatus = 'COMPLETED';
        else if (['CANCELLED', 'USERCANCELLED', 'REJECTED', 'FAILED'].includes(rawStatus)) frontendStatus = 'FAILED';

        // Activate subscription if completed
        if (frontendStatus === 'COMPLETED' && userId) {
          const { data: sub } = await supabase.from('subscriptions')
            .select('*').eq('order_id', orderId).single();
          if (sub && sub.status !== 'active') {
            await supabase.from('subscriptions').update({ status: 'active' }).eq('order_id', orderId);
            await supabase.from('profiles').update({ plan: sub.plan }).eq('user_id', sub.user_id);
          }
        }

        return new Response(JSON.stringify({ success: true, payment_status: frontendStatus, raw_status: rawStatus }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: data.message || 'Imeshindwa kupata hali ya malipo', raw: responseText }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        });
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'Kitendo hakijulikani' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });

  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ success: false, message: err.message || 'Hitilafu ya seva' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
