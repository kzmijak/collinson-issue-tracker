# Quality Attributes

Shared vocabulary for all agents. Per-area priorities live in the specific rule files.

| Attribute         | Meaning                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Cost**          | What the output costs to run. Effective tokens per decision, dollars per run, wasted spend on re-processing.             |
| **DX**            | How easy the code is to work with. Readability, API ergonomics, structure, fast feedback. "Will I get this in 3 months?" |
| **Reliability**   | How the system reacts to problems. Error handling, edge cases, graceful degradation, validation, idempotency.            |
| **Security**      | Protection against attack and misuse. Secret handling, prompt injection from issue content, least privilege.             |
| **Measurability** | Whether a change can be evaluated at all. Does this produce a number the harness can score?                              |

Scale: 1 (ignore unless broken) → 5 (top priority, reject the change if violated).

Interpret each attribute through the lens of your role. "Security" for a reviewer means auditing
secret handling and untrusted issue text; for a tester it means writing cases that exercise it.

**Measurability is the attribute specific to this project.** A change that cannot be measured
cannot be shown to be an improvement, which is the whole question this repository exists to answer.
