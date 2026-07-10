import { NextResponse } from "next/server";
import { classifyIntent } from "@/lib/chat/intent";
import { replyConversationally } from "@/lib/chat/respond";
import { generateVideo } from "@/lib/generate/generateVideo";
import type { GenerateVideoResponse, GenerateVideoRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateVideoRequest;
  if (!body.message || body.message.length > 2000) {
    return NextResponse.json({ status: "error", message: "Message is required and must stay under 2000 characters." }, { status: 400 });
  }

  const { intent, vibeOverride, regenerateReactionOnly } = classifyIntent(body.message);
  if (intent === "generate_video" || intent === "change_vibe" || intent === "regenerate") {
    const req: GenerateVideoRequest = {
      ...body,
      vibeOverride: body.vibeOverride ?? vibeOverride,
      regenerateReactionOnly: body.regenerateReactionOnly ?? regenerateReactionOnly
    };

    const encoder = new TextEncoder();
    let result: GenerateVideoResponse;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          result = await generateVideo(req, (stage) => {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "progress", stage }) + "\n"));
          });
          controller.enqueue(encoder.encode(JSON.stringify({ type: "result", data: result }) + "\n"));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "result",
                data: {
                  status: "error",
                  error: error instanceof Error ? error.message : "Unexpected generation failure."
                }
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache"
      }
    });
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