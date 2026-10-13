import React from "react";
import { GraduationCap, MessageCircle, User } from "lucide-react";
import { ChatRenderer } from "../chatbot/ChatRenderer";

/**
 * CounsellingTranscriptViewer
 * Renders counselling chat transcripts as a clear, structured conversation.
 * - Separates student and advisor messages
 * - Preserves line breaks and message turns
 * - Safely renders Markdown without raw markers or dangerouslySetInnerHTML
 * - Provides bounded, accessible scrolling
 */
export function CounsellingTranscriptViewer({ transcript }) {
  if (!transcript || !transcript.trim()) {
    return (
      <div className="transcript-empty-state">
        <span>No counselling chat transcript recorded for this candidate.</span>
      </div>
    );
  }

  let rawText = transcript.trim();
  let profileContext = null;

  // 1. Extract Chat Profile Context if present at the top
  const profileMatch = rawText.match(/^(?:Counsellor Chat Profile:|\[Chat Context:|\[Chat Profile:)[^\n]+/i);
  if (profileMatch) {
    profileContext = profileMatch[0].replace(/^\[|\]$/g, "").trim();
    rawText = rawText.slice(profileMatch[0].length).trim();
  }

  // 2. Identify conversational turns (Advisor / Student / Counsellor / Candidate)
  const turnRegex = /(Advisor|Student|Counsellor|Candidate|Assistant|User):\s*/gi;
  const turns = [];
  const splitIndices = [];
  let match;

  while ((match = turnRegex.exec(rawText)) !== null) {
    splitIndices.push({
      role: match[1].toLowerCase(),
      index: match.index,
      tagLength: match[0].length
    });
  }

  if (splitIndices.length > 0) {
    // If there is intro content before the first turn
    if (splitIndices[0].index > 0) {
      const intro = rawText.slice(0, splitIndices[0].index).trim();
      if (intro && !profileContext) {
        profileContext = intro;
      }
    }

    for (let i = 0; i < splitIndices.length; i++) {
      const current = splitIndices[i];
      const nextIndex = i + 1 < splitIndices.length ? splitIndices[i + 1].index : rawText.length;
      const content = rawText.slice(current.index + current.tagLength, nextIndex).trim();

      const isStudent =
        current.role === "student" ||
        current.role === "candidate" ||
        current.role === "user";

      turns.push({
        id: `turn-${i}`,
        role: isStudent ? "student" : "advisor",
        label: isStudent ? "Student / Candidate" : "IICT Admissions Advisor",
        content
      });
    }
  }

  return (
    <div className="counselling-transcript-container">
      <div className="counselling-transcript-header">
        <strong className="counselling-transcript-title">
          <MessageCircle size={15} color="var(--green)" aria-hidden="true" />
          <span>Counselling Conversation Transcript</span>
        </strong>
        {turns.length > 0 && (
          <span className="transcript-count-badge">
            {turns.length} message{turns.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {profileContext && (
        <div className="transcript-meta-banner" role="note">
          <strong>Chat Context:</strong> {profileContext}
        </div>
      )}

      <div
        className="counselling-transcript-scroll"
        tabIndex="0"
        role="region"
        aria-label="Counselling transcript scroll area"
      >
        {turns.length > 0 ? (
          turns.map((turn) => {
            const isStudent = turn.role === "student";
            return (
              <div
                key={turn.id}
                className={`transcript-message-turn ${
                  isStudent ? "transcript-turn-student" : "transcript-turn-advisor"
                }`}
              >
                <div className="transcript-sender-badge">
                  {isStudent ? (
                    <User size={12} aria-hidden="true" />
                  ) : (
                    <GraduationCap size={13} aria-hidden="true" />
                  )}
                  <span>{turn.label}</span>
                </div>
                <div
                  className={
                    isStudent
                      ? "transcript-bubble-student"
                      : "transcript-bubble-advisor"
                  }
                >
                  <ChatRenderer content={turn.content} />
                </div>
              </div>
            );
          })
        ) : (
          <div className="transcript-bubble-advisor">
            <ChatRenderer content={rawText} />
          </div>
        )}
      </div>
    </div>
  );
}
