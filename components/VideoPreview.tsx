"use client";

type VideoPreviewProps = {
  videoUrl: string;
  posterUrl?: string;
  caption: string;
};

export function VideoPreview({ videoUrl, posterUrl, caption }: VideoPreviewProps) {
  return (
    <div className="videoWrap">
      <div className="videoFrame">
        <video className="videoPoster" src={videoUrl} poster={posterUrl} controls playsInline preload="metadata" aria-label="Generated meme ad preview" />
        <span className="videoTag">8 SEC CUT</span>
      </div>
      <div className="videoActions">
        <a href={videoUrl} target="_blank" rel="noreferrer">
          Open MP4
        </a>
        <a href={videoUrl} download>
          Download
        </a>
      </div>
      <div className="captionBlock">
        <span className="captionLabel">Caption used</span>
        <p className="caption">{caption}</p>
      </div>
    </div>
  );
}
