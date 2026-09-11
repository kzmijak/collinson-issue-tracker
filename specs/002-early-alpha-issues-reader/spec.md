# 002 — Early Alpha Issues Reader

Status: draft
Covers: 0

## What I want

### 2026-09-10 — Init

ONLY MOCK INSTANCES!

In-Memory Stateful Fake GitHub Service:
  - Next iteration of Readonly Fake GitHub Services. This one exposes a simple mutational endpoint that allows the client to write a comment inside an issue. The data is still stored in memory, terminating the process will still result in data loss.

Proactive Issues Tracker
  - Direct evolution of Idle Issues Tracker. Upon new issues discovery, it writes a "I've been here!" comment under any issues it hasn't already touched. 

- Next to each entry, GitHub Service Terminal should display number of comments related to the issue
- GitHub Service Terminal should log each time a new comment gets added.
- GitHub console should fully reload and always paint the current state fully.