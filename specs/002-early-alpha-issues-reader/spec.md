# 002 — Early Alpha Issues Reader

Status: draft
Covers: 0

## What I want

### 2026-09-11 — Init

ONLY MOCK INSTANCES!

In-Memory Stateful Fake GitHub Service:
  - Next iteration of Readonly Fake GitHub Services. This one exposes a simple mutational endpoint that allows the client to write a comment inside an issue. The data is still stored in memory, terminating the process will still result in data loss.

Proactive Issues Tracker
  - Direct evolution of Idle Issues Tracker. Upon new issues discovery, it writes a "I've been here!" comment under any issues it hasn't already touched. 

- Next to each entry, GitHub Service Terminal should display number of comments related to the issue
- GitHub Service Terminal should log each time a new comment gets added.
- GitHub console should fully reload and always paint the current state fully.

### 2026-09-12 — Mock GitHub Improvements

Mock GitHub:
- After each update, the console is completely cleared and the new complete state is rendered.

Example of a single Issue entry print (desired format, unrealistic example)
[...]

Issues #12: (3)
Title: This is a sample issue
Content: Something bad has happened and I need some help
Comments:
  - [JohnDoe] 
    Well that sucks
  
  - [BenDover13]
    I hope all is well

  - [GitHub Issues Tracker]
    I've been here!

[...]
Repeat for all other issues

### 2026-09-12 — Mock GitHub Testing Improvements

- Contract should include a way to tell apart each complete snapshot of the Mock GitHub CLI