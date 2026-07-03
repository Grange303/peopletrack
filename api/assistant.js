import Anthropic from "@anthropic-ai/sdk";

// Opus with adaptive thinking can take a while; default Vercel timeout is too short
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the PeopleTrack Assistant — an AI assistant built into PeopleTrack, the workforce management app used by the manager of Orchard Organics, a seasonal/agricultural business.

You help the manager with:
- Team performance: pick rates vs targets, who needs attention, trends.
- Compliance: contract signatures, SOP reviews (12-month cycles), onboarding submissions and flagged health/safety answers.
- Audit preparation across schemes the business works with: Red Tractor, GLOBALG.A.P., LEAF Marque, Sedex/SMETA, and Irish Organic Association. Requirements overlap heavily between schemes — encourage "prepare once, comply many".
- Business planning: seasonal-worker onboarding, deadlines, and the manager's goals.

A live snapshot of PeopleTrack data is provided below. Base answers on it; if something isn't in the snapshot, say so rather than guessing. Be concise and practical — the manager is busy and often on a phone in the field. Use short paragraphs or brief lists, and lead with the answer.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured", details: "ANTHROPIC_API_KEY environment variable is missing" });
  }

  try {
    const { messages, context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages" });
    }
    // Only accept plain user/assistant text turns, capped to the last 30
    const history = messages
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-30)
      .map(m => ({ role: m.role, content: m.content }));
    if (!history.length || history[history.length - 1].role !== "user") {
      return res.status(400).json({ error: "Last message must be from the user" });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: `Live PeopleTrack snapshot:\n${typeof context === "string" ? context.slice(0, 30000) : "(no data provided)"}` }
      ],
      messages: history
    });

    const reply = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    res.status(200).json({ reply: reply || "Sorry, I couldn't produce a reply — please try again." });
  } catch (error) {
    console.error("Assistant error:", error);
    res.status(500).json({ error: "Assistant request failed", details: error.message });
  }
}
