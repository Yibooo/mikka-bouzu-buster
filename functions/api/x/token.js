export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { code, code_verifier, redirect_uri, user_id } = await context.request.json();

    if (!code || !code_verifier || !redirect_uri || !user_id) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { X_CLIENT_ID, X_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY } = context.env;

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return new Response(JSON.stringify({ error: "Token exchange failed", detail: err }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get X username
    const meRes = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = await meRes.json();
    const x_username = meData.data?.username || "";

    // Save tokens to Supabase
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/x_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id,
        access_token,
        refresh_token,
        x_username,
        expires_at,
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      return new Response(JSON.stringify({ error: "Failed to save tokens", detail: err }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, x_username }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
