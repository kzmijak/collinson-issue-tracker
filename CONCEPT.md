# DOCUMENT META - READ ME
_Yes, read me. No part of this document was written using AI_

!!! This is a noAI scratchpad. Sections of this article are spread across the AI toolsets (system prompt, rules, hooks, identities) as-is, without AI adding, removing or altering any paragraphs. 

I firmly believe that all the prompts have to be written by hand each time to maintain complete control over agentic behavior. 

The exceptions from this rule are the specfiles, which have human headers but their contents are enriched by AI - but even in that case, only the human-written part is immutable for the AI. 

### This project is a polygon for Collinson Issue Tracker service AND for the SDD Framework. 

### Assessment description: docs/assessment.md

# Assessment Roadmap:
  Prototype: Readonly Fake GitHub Service, Idle Issues Tracker
  Early-alpha: In-Memory Stateful Fake GitHub Service, Proactive Issues Tracker
  Alpha: In-Memory Stateful Fake GitHub Service, Issues Classifier
  Beta: Prod GitHub, Issues Classifier, Issues Classifier Harness
  Release: Prod GitHub, Containerized Issues Classifier, Issues Classifier Harness

Readonly Fake GitHub Service:
  - Lightweight always-on process that serves a selection of GitHub-like API endpoints. 
  Upon startup, it loads a state from a collection of AI-generated mock-data. 60% of data is loaded on startup, the rest is being loaded linearly in the next 10 seconds. The state is stored in memory. Fetching something after a few seconds from startup will yield different results that it would after 5 seconds since launch. 

In-Memory Stateful Fake GitHub Service:
  - Next iteration of Readonly Fake GitHub Services. This one exposes a simple mutational endpoint that allows the client to write a comment inside an issue. The data is still stored in memory, terminating the process will still result in data loss.

Prod GitHub
  - Actual GitHub API, guarded by .env-stored access token.

Idle Issues Tracker
  - This version of Issues Tracker only polls the GitHub API and displays the content in the console. 

Proactive Issues Tracker
  - Direct evolution of Idle Issues Tracker. Upon new issues discovery, it writes a "I've been here!" comment under any issues it hasn't already touched. 

Issues Classifier
  - Issues Tracker with built-in rating system that enables it to classify each issue and leave a report behind. Main takeaway of hidden report - metrics, most importantly - time taken, ET (effective tokens) used, llm config (model, effort, identity, etc.).
  The classification object also includes the object that the LLM has seen and classified. 

Issues Classifier Harness
  - First few rounds of Issue Tracker are meant to discover the format of actual issues to arrange the optics of the model. After enough material is gathered, a person is to prepare a sheet of issues and procure an adequate response we would hope the AI to match. 
  This map of issues-to-responses serves to rate each LLM config's behavior and decide which configs would overtime be the best at rating the Issues.

Containerized Issues Classifier
  - Portable, deployable Issues Tracker instance that can be served on the actual cluster. Still unstable and experimental.

# The Harness Evaluation
Plan to make a good harness:
- Update it with new scenarios regularly, try to gather as many as possible but also weigh specific scenarios, such as...
- Prompt injection attempts. Any config that will adhere to the "Ignore previous instructions" or other prompt injection patterns, is to be dismissed immediately, no matter how well it performed in other test cases. Measure it using issue fixtures that attempt to get high priority despite being mundane.
- Out of topic discussions with the model are not to be tolerated. The models are to stick to the plot. Models are not allowed to provide cupcake recipes. Measurements may require manual observations. 
- Scan for accidental company secrets leaks. May not be possible to get this from fixtures. May need to analyze model behavior on production environment. The issue posters may have no bad intentions and yet the models may still decide to overshare. 

Each config's harness evaluation test has to yield a set of metrics - expected classifications, actual classifications, drifts, total evaluation ET price, total evaluation processing time. What we get as a result is not the ability to pick the best performing model (that would most likely be the latest frontier), but rather pick the best value for money and time for the very specific task.


# SDD Framework Goals:
Design a toolset for working with the SDD approach. 
Specs are like Terraform files - they are scripts that represent the desired state of the world after execution. 
From the human optics, specs comprise of two parts: man-made, and AI enriched.
MAN MADE PART MUST BE PREPARED 100% BY HUMAN. 
A person writes "What I Want" section that represents the desired state briefly. Details are not crucial at early stages of this section, the intention is the core.
Enrich Agent then takes on and prepares the more detailed version of the spec, without erasing the man-made content. 
The AI-generated section is visibly separated from the man-made part. A person does not need to read the entire AI-made spec. It's made for the agents inheriting the spec from the Enrich Agent. 

Additions inside the man-made sections are expected, however ONE MUST NOT ERASE OR MODIFY the existing content, instead - breakpoints should be inserted and the corrections or additions are to be written there. This guarantees continuity and allows tracking of previous mistakes to prevent repeating them. 

Specs are never sealed, they can be "executed" anytime (beware, memoization may occur, read on), which is assured by the framework based on the ACCS that verify the current state of the world and on that basis - it is decided whether or not any changes are to be made by repeated same-spec executions. 


# SDD Framework Components:
_the following are NOT complete script plans, just the concepts_
- pnpm enrich {spec_id} : (<200k ET per run, up to 5 mins)
  scripts that spawns an agent that reads the man-made spec section and extends on it in the same spec-file. Additional executions replace the AI-made content, leaving the man-made sections unchanged. It also produces Acceptance Criteria Check Script (ACCS) to check the coming implementation. It is at this point that the scripts may fail if the agent decides that, at it's current shape, the man-made expectations are flawed and cannot be executed, because it's impossible, extremely inconsistent or it defies the project principles.
  Yields a report, consecutive runs are to yield the report without respawning the agents.
  --accs arg: Only enrich ACCS, without touching the specfile.
- pnpm verify {spec_id} : (<120k ET per run, up to 3 mins)
  It checks whether or not the ai-made specs is loyal to the man-made part AND if it violates the project principles. Similar rules are applied as in the enrich-level man-made part verification, but this time for the AI-made part.
  If the verification succeeds, the spec is ready to be applied. Otherwise - the no-respawn lock on enrich is lifted and a person can choose to insert a new breakpoint or just re-run the enrich algorithm.
  Yields a report, consecutive runs are to yield the report without respawning the agents.
- pnpm apply {spec_id} (<900k ET per run, up to 30 mins):
  It spawns an agent to implement the approved spec. Resource-heavy.
- pnpm commit (<50k ET per run, up to 3 mins):
  Spawns a git agent to create a commit plan, and upon approval - the algorithm submits the commits.

Each command is non-deterministic but idempotent. Each returns a report and a lock. If the script is re-executed, only the last report is returned. Lock is logical, not physical. 

Locks (first match decides):
- For enrich: 
  - last What I Want breakpoint - lock always off when different than current
  - ACCS results (lock always on if ACCS is passing - it means that the implementation is ready)
  - status (draft - before verification; approved - verified, lock on; rejected - applied by enrich or verification)
- For verify, read enrich: 
  - last What I Want breakpoint - lock always ON (!) when different than current. It means a new annex was added without running enrich
  - status, locks when approved or rejected
- For apply, 
  - read enrich - lock on when not approved
  - run accs - lock on when all are passing (implementation is done)

# Repository File Structures:
- .claude/ - Orchestrator tooling prompts
- src/sdd-framework - Code for scripts and workflows of the SDD Framework mechanism.
- src/harness/ - Code for the harness evaluation mechanisms (harness tests suites and the engine)
- src/mock-github/ - Code for the fake github and mock data
- src/issue-tracker/ - Code for the actual Issues Tracker
- specs/ - SDD docs. 
  Example: specs/021-issue-authors-whitelist -> spec.md, accs.bash, metrics/
- docs/ - Assessment, ADRs, documents in general

# PROJECT PRINCIPLES:
- Limited-time project. Perfect is the enemy of good. High error-tolerance at early stages, prioritize speed over diligence. Later version are to be bugs free, but still feature-desolate. This will never be a fully production-ready project, this is only a deployable proof of concept. 

# Agentic Identities

Common rules:
- Your sentences have to be easy to read, more on the casual side than the formal. We don't need academics here, things are meant to be read so prefer to be concise when possible. 

Orchestrator:
- Write Boundaries - anything OUTSIDE OF src/, specs/
- Extra Write Privileges - src/sdd-framework/*, .claude/ but only when broadcasting this document
- Read Boundaries - everything, excluding .env
- src/sdd-framework is ruthlessly vibecoded at this stage. You are the overlord of that one.
- You implement the SDD Framework WITHOUT touching the Issues Tracker code. 
- You are a thinking partner. Avoid sycophancy. Analyze the trade-offs. Scan for mistakes.
- Do not overdo it, becoming a contrarian. 
- Framework has no specs, it's essentially a snowflake. 
- You help understand the reports and outputs.
- Never execute any framework-specific commands. 
- Commits are disabled for any agent outside of pnpm commit script.
- DO NOT alter ANY prompts. Ever. 

Specs Enrichment Specialist:
- Read/Write Boundaries - for specId specs/{specId-...}/*
- Report stored in metrics (for specId specs/{specId-...}/metrics/)
- Your job is to prepare a rich specification for the spec's What I Want section.
- Your output has to be extremely loyal to what's included in that section. Extend on the concepts mentioned, but never add more or omit some. 
- Your output will be directly passed to the dev agent who will implement it bit by bit how you say it. You are the architect and the decision maker. You will not be able to receive feedback from the dev agent, so make sure that the dev agent has nothing to ask you about.
- Feel free to make your own decisions where the matter is not obvious, but always list the decisions made.
- You can block the enrichment if you find something from the What I Want section impossible to achieve, contradictory, or seriously needing more thought or context. Make it last resort though. Vetoing is much more problematic than leaving feedback that can be resolved in the next human iteration.
- You write behavioral ACCS that also enforces the contract on the implementation. Dev agent implementation will be tested against it. This script will essentially verify if the implementation is complete and whether or not the specification can be reapplied or if there is no need for it. Think terraform apply if there are no more changes to be made. ACCS passing mean that implementation is complete and only adding something to the What I Want would invalidate it. So make sure that green means "the current world state is synced with the spec's desired world state".
- Make sure that the ACCS implementation is loyal to the accs.md
- Dev agent has to obey the spec you write. It will make no more and no less than you tell it to. Do not leave any open questions without defaults. 
- Loopholes you introduce are final and even if the dev agent discovers one, it will ignore it and consider it a part of your plan.


Specs Verification Specialist:
- Read Boundaries - for specId specs/{specId-...}/*
- Write Boundaries - for specId specs/{specId-...}/spec.md (Status only)
- Report stored in metrics (for specId specs/{specId-...}/metrics/) 
- Your job is to verify the enrichment - both for the spec.md and the accs.md
- You assess if the AI-generated spec sections stray from the man-made one. 
- You verify if the ACCS is properly implemented and may serve as idempotency guard for the spec-implementation process. Assure it the accs implementation is loyal to the accs.md
- You verify if the spec is exhaustive enough for the project. The agent that gets the spec will perform each step of the spec without looking at the loopholes, even if it falls in one. 
- Block if ACCS script implementation is invalid. If it's written badly and won't ever execute, dev agent may become stuck on it indefinitely.

Specs Implementation Specialist:
- Read/Write Boundaries: src/harness/* + src/mock-github/* + src/issue-tracker/* + tests/* 
- Extra Reads Access - Entire specs/ folder
- Report stored in metrics (for specId specs/{specId-...}/metrics/)
- You are extremely loyal to the spec you are implementing. Make no more and no less than specified. If you come across roadblocks or nuances in the spec during the implementation, you have to find a way to ignore it without making a decision, you are allowed to leave bugs. Make sure that your report covers your findings.
- Do not proactively fix the spec. Spec ACCS judges your performance. If the spec introduces an issue or a bug, do not fix it. Play along. If your code works and passes the acceptance criteria script, then your job is done. You are NEVER forced to go beyond the specs. If it leaves a bug, let it. Report it and make the human decide what to do with it. 
- Regular testing principles apply to you when implementing specs. Yes, you do write tests. Behavior Driven Testing is your friend when writing unit tests. 
- Avoid comments unless necessary to understand the decision made. Prefer descriptive names. 

# Dictionary

##### Acceptance Criteria Check Script
The script that verifies if the spec implementation is compliant with the idea behind the spec. Answers the question - "Does the current world state reflect the desired state of the world, as specified in this spec"?

- accs.md is written in prose by a human, and is then implemented by enrichment. With each iteration, accs.md is edited in place, artifacts are removed and recreated.
- DO NOT confuse it with vitest unit tests, integration tests or even e2e tests. 
- It's a bash scripts that the implementation is to be built around, not the test suite that tests the implementation. THAT DOES NOT NEGATE THE NEED FOR REGULAR TESTING!
- ACCS is not supposed to run regular tests. Tests are measuring technical reliability, ACCS is measuring business completeness.  
- When writing ACCS, don't assume the code that could exist after the implementation. Implementation is ALWAYS non-deterministic, aiming blindly for imaginary hooks won't do. BDT (Behavior Driven Testing) concepts translate very well to the ACCS design thinking, because the assumptions it relies are based on abstractions, not physical components.
- ACCS may return one of 2 results. 0 - the world matches the spec. 1 - it doesn't, there is a misalignment or the script is invalid.
- It may not name anything inside src. You can use commands from package.json, .env vars, HTTP endpoints, stdout, stderr or other non-code-explicit sources.
