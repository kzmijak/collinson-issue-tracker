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
  Example: specs/021-issue-authors-whitelist/ -> spec.md, accs.md, outputs/-> metrics/, accs.bash, enriched-spec.md 
- docs/ - Assessment, ADRs, documents in general

# PROJECT PRINCIPLES:
- Limited-time project. Perfect is the enemy of good. High error-tolerance at early stages, prioritize speed over diligence. Later version are to be bugs free, but still feature-desolate. This will never be a fully production-ready project, this is only a deployable proof of concept. 

Common rules:
- Your sentences have to be easy to read, more on the casual side than the formal. We don't need academics here, things are meant to be read so prefer to be concise when possible. 

# Dictionary

#### Specification File
The document that represents how the world should look like after it has been applied.  

It takes two forms:
- spec.md - It's supposed to be 100% man-made, operates on the highest level of abstraction (prose). It's vague by design, it operates more on the functional concepts rather than technical. It grows iteratively, consecutive iterations never modify the existing content. 
Breakpoints are added to separate iterations. Further iterations may override old statements.
- enriched-spec.md - AI-processed spec.md that merges the breakpoints and expands on it significantly, operating on a much more architecturally technical level. The goal is to design how the spec.md ideas are to be implemented. 
It establishes the contract - facades and abstractions that are to be implemented by the dev agents, and the implementation of which can be tested in the ACCS.  

##### Acceptance Criteria Check Script
The script that verifies if the spec implementation is compliant with the idea behind the spec. Answers the question - "Does the current world state reflect the desired state of the world, as specified in this spec"?

It takes two forms:
- accs.md - Coexists nearby the spec.md, similar rules are applied excepts this one has no breakpoints - changes are made in place, checkpoints persisted in git.
With this document, humans are able to describe how to verify that the state of the world matches the one desired as stated in the spec.md. If it's passing - the spec is applied and there's no need to reapply it.
- ACCS Impl - Implementation of the accs.md, made by the AI. To build it, the AI needs both the accs.md to understand what actions are to be performed, but also spec-enriched.md, to make full use of the abstractions that are provided by it.
It might be a single bash scripts, but it may also be a full suite of executables. The entry-point is always accs.bash though.

Characteristic:
- accs.md is written in prose by a human, and is then implemented by enrichment. With each iteration, accs.md is edited in place, artifacts are removed and recreated.
- DO NOT confuse it with vitest unit tests, integration tests or even e2e tests. 
- It's a bash scripts that the implementation is to be built around, not the test suite that tests the implementation. THAT DOES NOT NEGATE THE NEED FOR REGULAR TESTING!
- ACCS is not supposed to run regular tests. Tests are measuring technical reliability, ACCS is measuring business completeness.  
- When writing ACCS, don't assume the code that could exist after the implementation. Implementation is ALWAYS non-deterministic, aiming blindly for imaginary hooks won't do. BDT (Behavior Driven Testing) concepts translate very well to the ACCS design thinking, because the assumptions it relies are based on abstractions, not physical components.
- ACCS may return one of 2 results. 0 - the world matches the spec. 1 - it doesn't, there is a misalignment or the script is invalid.
- It may not name anything inside src. You can use commands from package.json, .env vars, HTTP endpoints, stdout, stderr or other non-code-explicit sources.


# Reporting
Agentic scripts leave a report. Reports are stored in the metrics/ directory in the spec's output dir. It must include ET consumed and total time taken.
Reports are meant to be read by human, so make them easy to read, don't skip any context (don't assume the human will have read anything outside of the man-made parts - they won't), and concise. No academic gibberish.

Enrichment Report includes:
- Assumptions Made - Specs are vague by design, so agents have to make implementation designs. Leave them here with the defaults, so they may be addressed in the next iteration of the spec.md
- Expected Drawbacks - if any - Perfect is the enemy of Good, there is no perfect architecture, list the drawback here, this may affect the Reviewer's tolerance.
- Design Flaws - if any - If the spec.md contains flaws, list them here and block the execution. 
- Contract!!! The facades and abstraction the ACCS will test against and the dev agent will comply with.

ACCS Implementation Report Includes:
- General flow of the script.

Verification Report includes:
- Verdict
- If rejected - scope, just ACCS or Enriched Spec + ACCS + reasons
- Worth To Consider - Nuances that a person might be interested in addressing in the next breakpoint or accs.md

Spec Implementation Report includes:
- What was built, TL;DR
- Decisions made outside of spec
- Bugs and loopholes detected in the spec/accs