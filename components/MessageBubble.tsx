"use client";

import { VideoPreview } from "@/components/VideoPreview";
import type { GenerateVideoResponse } from "@/lib/types";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  result?: GenerateVideoResponse;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasText = Boolean(message.text.trim());
  return (
    <article className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="bubble">
        {hasText ? <p>{message.text}</p> : null}
        {message.result?.progress?.length ? (
          <ol className="progressList">
            {message.result.progress.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : null}
        {message.result?.videoUrl && message.result.caption ? (
          <VideoPreview
            videoUrl={message.result.videoUrl}
            posterUrl={message.result.posterUrl}
            caption={message.result.caption}
          />
        ) : null}
        {message.result?.selectedAssets?.reasons?.length ? (
          <details className="generationDetails">
            <summary>Why this cut</summary>
            <ul>
              {message.result.selectedAssets.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </details>
        ) : null}
        {message.result?.selectedAssets?.audio.source === "freesound" ? (
          <p className="assetCredit">
            Audio: {message.result.selectedAssets.audio.sourceUrl ? (
              <a href={message.result.selectedAssets.audio.sourceUrl} target="_blank" rel="noreferrer">
                {message.result.selectedAssets.audio.title ?? message.result.selectedAssets.audio.id}
              </a>
            ) : message.result.selectedAssets.audio.title ?? message.result.selectedAssets.audio.id}
            {message.result.selectedAssets.audio.creator ? ` by ${message.result.selectedAssets.audio.creator}` : ""}
            {message.result.selectedAssets.audio.licenseUrl ? (
              <> · <a href={message.result.selectedAssets.audio.licenseUrl} target="_blank" rel="noreferrer">license</a></>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}
