# 001 — choices the spec did not make

> **Superseded.** This records work against `specs/001-github-read-path.md`, which the operator
> deleted in favour of `specs/001-prototype-issues-reader/` — a different program. The code these
> notes describe was removed with it; the notes stay because what was learned outlived the spec,
> and because a dead end is worth more to a reader than a tidy history.

Picked while implementing `specs/001-github-read-path.md`. Each is a behaviour nobody decided; they
are recorded here rather than resolved silently.

- **Log line shape.** `#7 [open] Title — @author — labels: bug, help wanted — created <ISO> — <url>`.
  The spec names the fields and says human-readable text; the ordering and separators are mine. An
  issue with no labels renders `labels: none` rather than an empty tail.
- **`url` is `html_url`.** The field a human follows, not the API address of the resource.
- **Missing author.** GitHub returns `user: null` for deleted accounts; that normalises to `unknown`.
- **Backoff sequence.** The ceiling of ten times the interval is not a power of two, so consecutive
  failures wait 2×, 4×, 8×, 10×, 10× … and return to 1× after the first pass that succeeds.
- **Runtime failures go to stderr, issue lines to stdout.** The spec puts configuration errors on
  stderr and is silent about a failed pass; splitting them keeps stdout a clean stream of issues.
- **`FakeGitHub` takes its issues from its constructor** rather than reading `fixtures/issues/`.
  Nothing else needs the fixture yet, and the test reads better with the data next to the assertion.
- **Pull requests are not filtered out.** `/issues` returns pull requests as issues. The spec says
  "open issues only, first page" and says nothing about pull requests, so none are excluded — the
  smoke run against `octocat/Hello-World` prints several, with `/pull/` URLs.
- **The acceptance case in the configuration test is asserted at `parseConfig`, not by spawning the
  worker.** The eight rejection cases spawn the real entrypoint and assert a non-zero exit with a
  message on stderr and nothing on stdout. Spawning the accepted pair (`a/b`, `1000`) would send a
  request to `api.github.com`, and the spec requires the deterministic check to depend on neither the
  network nor anyone's repository. The alternative — an API base URL override so the entrypoint could
  be pointed at a stub — is a configuration hook the spec does not ask for.

The log line interpolates the issue title, which is untrusted, without escaping. Logging is not
prompt position and nothing parses this output, so no sanitising is done here; the question belongs
to the spec that first puts issue text in front of a model.
