"use client";

import { useContext, useEffect, useRef, useState } from "react";
import type { AppSnapshot, Command } from "@david/contracts";
import {
  channelLabel,
  conversationPulse,
  conversationThread,
  isWalkthroughFloor,
} from "@david/domain/delivery";
import { Button, dateTime, QuietWalkthroughContext } from "./ui";

export function ConversationThread({
  state,
  proposalId,
  act,
  busy,
  focusComposer = false,
}: {
  state: AppSnapshot;
  proposalId: string;
  act: (command: Command) => Promise<unknown>;
  busy: boolean;
  focusComposer?: boolean;
}) {
  const quiet = useContext(QuietWalkthroughContext);
  const floor = isWalkthroughFloor(state, quiet);
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const contact = state.contacts.find((item) => item.id === proposal?.contactId);
  const messages = proposal ? conversationThread(state, proposal.opportunityId) : [];
  const pulse = proposal ? conversationPulse(state, proposal.opportunityId) : null;
  const [note, setNote] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusComposer && contact?.humanTakeover) composer.current?.focus();
  }, [focusComposer, contact?.humanTakeover]);

  if (!proposal || !contact) return null;

  return (
    <section className="conversation-thread" aria-label="Workspace conversation log">
      <span className="today-kicker">
        {floor ? "Live thread" : "Workspace conversation log"}
      </span>
      {pulse && pulse.moves > 0 && (
        <ul className="conversation-pulse" aria-label="What already happened on this thread">
          {pulse.linkedinSent > 0 && (
            <li>
              <strong>{pulse.linkedinSent}</strong>
              <span>LinkedIn request{pulse.linkedinSent === 1 ? "" : "s"}</span>
            </li>
          )}
          {pulse.linkedinAccepted > 0 && (
            <li>
              <strong>{pulse.linkedinAccepted}</strong>
              <span>connect{pulse.linkedinAccepted === 1 ? "" : "s"} accepted</span>
            </li>
          )}
          {pulse.emailOut + pulse.linkedinMessages + pulse.websiteTurns > 0 && (
            <li>
              <strong>{pulse.emailOut + pulse.linkedinMessages + pulse.websiteTurns}</strong>
              <span>messages</span>
            </li>
          )}
          {pulse.emailIn > 0 && (
            <li>
              <strong>{pulse.emailIn}</strong>
              <span>{pulse.emailIn === 1 ? "reply" : "replies"}</span>
            </li>
          )}
          {pulse.meetingsBooked > 0 && (
            <li>
              <strong>{pulse.meetingsBooked}</strong>
              <span>meeting{pulse.meetingsBooked === 1 ? "" : "s"} booked</span>
            </li>
          )}
        </ul>
      )}
      <p className="help">
        {contact.humanTakeover
          ? "A person is writing in this log. The specialist stops."
          : floor
            ? "The specialist already ran this thread. Take over only if you need to write here. Nothing is sent from this log."
            : "Take over conversation to write here. No mail is sent from this log."}
      </p>
      {messages.length ? (
        <ol className="conversation-log">
          {messages.map((item) => (
            <li key={item.id} data-kind={item.kind} data-actor={item.actor} data-channel={item.channel}>
              <div>
                <span className="conversation-who">
                  <strong>
                    {item.kind === "event"
                      ? item.eventLabel
                      : item.actor === "david"
                        ? "DAVID"
                        : item.actor === "human"
                          ? contact.name
                          : "Source"}
                  </strong>
                  <span className="conversation-channel">{channelLabel(item.channel)}</span>
                </span>
                <time dateTime={item.at}>{dateTime(item.at, state.workspace.timeZone)}</time>
              </div>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No messages in this log yet.</p>
      )}
      {contact.humanTakeover && state.workspace.mode === "fixture" && (
        <form
          className="conversation-composer"
          onSubmit={(event) => {
            event.preventDefault();
            const text = note.trim();
            if (!text) return;
            void act({ type: "human_note", proposalId, text }).then(() => setNote(""));
          }}
        >
          <label>
            Owner note
            <textarea
              ref={composer}
              className="input"
              rows={3}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Write in the workspace log. Nothing is sent."
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy || !note.trim()}>
            Add note to log
          </Button>
        </form>
      )}
    </section>
  );
}
