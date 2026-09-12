# Horizon AI inside the Horizon Works Outreach Panel

The outreach panel is now the host application for the Horizon AI roadmap. Do not create a separate Horizon AI product surface for the planned features unless explicitly decided later.

## Product direction

The existing outreach workflow remains the operational core. Horizon AI becomes the intelligence layer across it.

Users should be able to say simple things in natural language and eventually have Horizon classify, organize, remember, connect, and act on the information.

## Rollout

1. Embedded AI command center — current step
2. Automatic organization of client/project/task information
3. Persistent long-term memory
4. Context engine across outreach, projects, clients, and conversations
5. Knowledge/document brain
6. Tool integrations and authorized actions
7. Activity/audit timeline
8. Proactive intelligence
9. Automations
10. Specialized agents

## Current implementation

- `src/horizon-ai.tsx` contains the AI command center UI.
- `src/horizon-entry.tsx` mounts it as an overlay inside the existing panel.
- `api/ai.ts` provides a server-side Gemini endpoint.
- The AI receives the current outreach prospect context from local storage.
- Gemini credentials remain server-side through `GEMINI_API_KEY`.

## Important boundary

The current AI endpoint is intentionally advisory. It must not claim persistence or external actions that have not actually occurred. Future phases should introduce typed domain commands, persistent storage, authorization, and audit events before autonomous actions are enabled.
