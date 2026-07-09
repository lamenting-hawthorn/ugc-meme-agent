import { NextResponse } from "next/server";
import { generateVideo } from "@/lib/generate/generateVideo";
import type { GenerateVideoRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateVideoRequest;
  if (!body.message || body.message.length > 2000) {
    return NextResponse.json({ status: "error", error: "Message is required and must stay under 2000 characters." }, { status: 400 });
  }
  const result = await generateVideo(body);
  return NextResponse.json(result, { status: result.status === "success" ? 200 : 422 });
}
