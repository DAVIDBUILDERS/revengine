"use client";

import { useEffect, useRef, useState } from "react";
import type { AppSnapshot, Command } from "@david/contracts";
import { conversationThread } from "@david/domain/delivery";
import { Button, dateTime } from "./ui";

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
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const contact = state.contacts.find((item) => item.id === proposal?.contactId);
  const messages = proposal ? conversationThread(state, proposal.opportunityId) : [];
  const [note, setNote] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusComposer && contact?.humanTakeover) composer.current?.focus();
  }, [focusComposer, contact?.humanTakeover]);

  if (!proposal || !contact) return null;

  return (
    <section className="conversation-thread" aria-label="Workspace conversation log">
      <span className="today-kicker">Workspace conversation log</span>
      <p className="help">
        {contact.humanTakeover
          ? "A person is writing in this log. The specialist stops."
          : "Take over conversation to write here. No mail is sent from this log."}
      </p>
      {messages.length ? (
        <ol className="conversation-log">
          {messages.map((item) => (
            <li key={item.id} data-kind={item.kind} data-actor={item.actor}>
              <div>
                <strong>{item.actor === "david" ? "DAVID" : item.actor === "human" ? contact.name : "Source"}</strong>
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
