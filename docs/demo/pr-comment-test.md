# Sentinel — live PR comment test

This PR exists to validate Sentinel's delivery layer end to end: when the demo
payments suite fails with the engineered duplicate-charge race, Sentinel recalls
the matching prior incident from Cognee Cloud and posts a grounded review as a
native comment on this pull request — the "better than CodeRabbit" moment, but
backed by memory instead of just the diff.

Expected comment: a recalled history entry linking the failure to the
idempotency-key fix, quoted from Cognee memory.
