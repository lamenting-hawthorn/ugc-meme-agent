"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble, type ChatMessage } from "@/components/MessageBubble";
import { appendMemory, buildMemoryEntry } from "@/lib/chat/memory";
import type { GenerateVideoResponse, ProductUnderstanding, CreativePlan } from "@/lib/types";

type ChatResponse =
  | { type: "reply"; message: string }
  | { type: "generation"; message: string; result: GenerateVideoResponse };

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Send me your product URL and I'll turn it into a short UGC-style meme ad."
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastContext, setLastContext] = useState<{
    productUnderstanding?: ProductUnderstanding;
    lastCreativePlan?: CreativePlan;
    lastReactionAssetId?: string;
    conversationMemory?: import("@/lib/types").ConversationMemoryEntry[];
  }>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const canRegenerate = useMemo(() => Boolean(lastContext.productUnderstanding), [lastContext]);
  const loadingLabel = canRegenerate ? "Generating updated cut..." : "Generating first cut...";
  const starterPrompts = [
    { label: "Reaction cam", text: "make a reaction-style ad for my product. here's the site: calai.app", tone: "ME WHEN" },
    { label: "POV format", text: "make a POV meme ad for my product. here's the site: calai.app", tone: "POV" },
    { label: "Manual vs app", text: "make a manual-vs-automated meme ad for my product. here's the site: calai.app", tone: "BEFORE / AFTER" }
  ];

  async function submit(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    setLastContext((current) => ({
      ...current,
      conversationMemory: appendMemory(
        current.conversationMemory ?? [],
        buildMemoryEntry({ role: "user", text })
      )
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, previousContext: lastContext })
      });
      const payload = (await response.json()) as ChatResponse;
      if (payload.type === "generation") {
        setLastContext((current) => ({
          productUnderstanding: payload.result.productUnderstanding ?? current.productUnderstanding,
          lastCreativePlan: payload.result.creativePlan ?? current.lastCreativePlan,
          lastReactionAssetId: payload.result.selectedAssets?.reaction.id ?? current.lastReactionAssetId,
          conversationMemory: appendMemory(
            current.conversationMemory ?? [],
            buildMemoryEntry({
              role: "assistant",
              text: payload.message || payload.result.caption || "Generated video result",
              resultCaption: payload.result.caption
            })
          )
        }));
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: payload.message,
            result: payload.result
          }
        ]);
      } else {
        setLastContext((current) => ({
          ...current,
          conversationMemory: appendMemory(
            current.conversationMemory ?? [],
            buildMemoryEntry({ role: "assistant", text: payload.message })
          )
        }));
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: payload.message }]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: "I hit a local error. Check the server logs and try again." }
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  }

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  return (
    <section className="chatPanel" aria-label="Meme ad chat">
      <header className="topbar">
        <div>
          <p className="eyebrow"><span className="eyebrowMark">✦</span> UGC Meme Agent</p>
          <h1>Make your product the punchline.</h1>
          <p className="topbarSub">Drop a URL. Get a scroll-stopping cut in ~8 seconds.</p>
        </div>
        <div className="statusPill"><span className="statusDot" aria-hidden="true" />{busy ? "rendering" : "ready"}</div>
      </header>

      <div className="messages" ref={messagesRef}>
        {messages.length === 1 ? (
          <div className="starterCard">
            <div className="starterKicker">Pick a native format</div>
            <p className="starterTitle">The best ads feel like posts first.</p>
            <div className="starterGrid">
              {starterPrompts.map((starter) => (
                <button key={starter.label} type="button" onClick={() => void submit(starter.text)} disabled={busy}>
                  <span>{starter.tone}</span>
                  {starter.label}
                  <small>calai.app demo ↗</small>
                </button>
              ))}
            </div>
            <p className="starterHint">Or paste any public product URL below.</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      <div className="quickActions">
        <span className="quickLabel">Remix the cut</span>
        <button type="button" onClick={() => void submit("make it funnier")} disabled={!canRegenerate || busy}>
          Funnier
        </button>
        <button type="button" onClick={() => void submit("make it dramatic")} disabled={!canRegenerate || busy}>
          Dramatic
        </button>
        <button type="button" onClick={() => void submit("less cringe")} disabled={!canRegenerate || busy}>
          Less cringe
        </button>
      </div>

      <form className="composer" onSubmit={onSubmit}>
        {busy ? (
          <div className="composerStatus" aria-live="polite">
            <span className="composerSpinner" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="I'm building CalAI, a calorie-tracking app. Here's the site: calai.app"
          rows={2}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Working" : "Send"}
        </button>
      </form>
    </section>
  );
}
