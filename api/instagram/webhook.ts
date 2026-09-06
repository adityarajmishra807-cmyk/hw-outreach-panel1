const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "HW_IG_VERIFY_7f3c9a21b6d84e5f";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Instagram webhook event:", JSON.stringify(body));
      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, POST" },
  });
}
