import { NextResponse } from "next/server";
import { classifyIntent } from "@/lib/chat/intent";
import { replyConversationally } from "@/lib/chat/respond";
import { generateVideo } from "@/lib/generate/generateVideo";
import type { GenerateVideoRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateVideoRequest;
  if (!body.message || body.message.length > 2000) {
    return NextResponse.json({ status: "error", message: "Message is required and must stay under 2000 characters." }, { status: 400 });
  }

  const { intent, vibeOverride } = classifyIntent(body.message);
  if (intent === "generate_video" || intent === "change_vibe" || intent === "regenerate") {
    const result = await generateVideo({ ...body, vibeOverride: body.vibeOverride ?? vibeOverride });
    return NextResponse.json({
      type: "generation",
      message: result.status === "success" ? "" : result.error,
      result
    }, { status: result.status === "success" ? 200 : 422 });
  }

  return NextResponse.json({
    type: "reply",
    message: await replyConversationally(
      body.message,
      body.previousContext?.productUnderstanding,
      body.previousContext?.conversationMemory
    )
  });
}
