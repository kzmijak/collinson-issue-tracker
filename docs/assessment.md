# AI Platform Engineer Take-Home Exercise

> Verbatim transcription of `docs/assessment.docx`. Headings and list markers are the source
> document's own; nothing has been added, reworded or summarised.

We have deliberately left this exercise open. In this role you would be defining how our teams build
and measure AI systems, so the decisions you make about scope and approach are part of what we want
to see.

We are most interested in how you work through the problem: the decisions you make, the assumptions
you choose, and how you get there. If you have an open question that you would normally ask a
stakeholder, write down the question and the assumption you went with.

## The exercise

Build a small LLM-powered service, and more importantly an evaluation harness for it.

The service: takes a raw GitHub issue (title and body) and returns a structured triage decision:
what kind of issue it is, how urgent it is, and whether it needs a human to look at it. Keep this
part simple. It exists to give the harness something to measure. It is not the main focus.

The harness: this is the core of the exercise. Show us how you would know, with confidence, whether
a change made the service better. What you measure, and how you build a test set you can trust, is
part of the problem. Quality is not the only thing that matters: a change that is more accurate but
three times the price is a real trade-off, and we want to see it.

You can use real GitHub issues from any public repo, or build a dataset yourself.

This is a backend exercise, so please do not build a front end. A CLI or plain test output is
enough.

We are not looking for volume. A small, focused submission with clear reasoning is better than a
large one. A harness that measures one thing well is better than one that measures five things
loosely.

## Stack

TypeScript or Python. Everything else — storage, eval tooling, whether you use an existing framework
or build your own — is your choice, and we are interested in the choice itself.

## What to submit

A public GitHub repo. Two things matter, in this order:

- How you worked. Show us your thinking in whatever form it actually happened: upfront planning, an
  AI chat session, notes, commits, or any mix of these. We want to follow your reasoning and see the
  decisions you made, not read a polished write-up. If you cut something or ran out of time, a short
  note on why is more useful than the finished thing.

- The service and harness, plus a short README: what you built, how to run it, what your eval
  results showed, and your assumptions.

Let us know once you have finished.
