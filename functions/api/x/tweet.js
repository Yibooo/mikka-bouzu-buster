export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { user_id, text } = await context.request.json();

    if (!user_id || !text) {
      return new Response(JSON.stringify({ error: "Missing user_id or text" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Require site URL in tweet
    if (!text.includes("https://mikka-bouzu-buster.com")) {
      return new Response(JSON.stringify({ error: "Tweet must include site URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { X_CLIENT_ID, X_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY } = context.env;

    // Get tokens from Supabase
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/x_tokens?user_id=eq.${user_id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const tokens = await tokenRes.json();

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ error: "X not connected" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { access_token, refresh_token, expires_at } = tokens[0];

    // Refresh if expired
    if (new Date(expires_at) <= new Date()) {
      const refreshRes = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`),
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token,
        }),
      });

      if (!refreshRes.ok) {
        return new Response(JSON.stringify({ error: "Token refresh failed. Please reconnect X." }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const refreshData = await refreshRes.json();
      access_token = refreshData.access_token;
      const new_expires_at = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      // Update tokens in Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/x_tokens?user_id=eq.${user_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          access_token,
          refresh_token: refreshData.refresh_token || refresh_token,
          expires_at: new_expires_at,
        }),
      });
    }

    // Post tweet
    const tweetRes = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!tweetRes.ok) {
      const err = await tweetRes.text();
      return new Response(JSON.stringify({ error: "Tweet failed", detail: err }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const tweetData = await tweetRes.json();

    return new Response(JSON.stringify({ success: true, tweet_id: tweetData.data?.id }), {
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
