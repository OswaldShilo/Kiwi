import argparse
import os
import sys

from sentinel.cognee_client import CogneeClient
from sentinel.ingest import process_report
from sentinel.reviewer import build_review, get_diff, post_pr_comment


def main() -> int:
    # Cognee's LLM output contains characters (e.g. U+202F) that Windows
    # cp1252 consoles can't encode — never let printing kill the pipeline.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description="Kiwi CI Ingestion Runner")
    ap.add_argument("xml_path")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--review", action="store_true", help="write a review per failure")
    ap.add_argument("--post", action="store_true", help="post review as PR comment")
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    ap.add_argument("--pr", type=int, default=None)
    ap.add_argument("--ci", action="store_true", help="never exit non-zero")

    args = ap.parse_args()
    try:
        client = CogneeClient()
        results = process_report(
            args.xml_path,
            run_id=args.run_id,
            client=client,
            dataset=client.settings.dataset
        )
        if args.review:
            diff = get_diff()
            for result in results:
                review = build_review(result, diff=diff)
                print("\n" + review)
                if args.post and args.repo and args.pr:
                    post_pr_comment(
                        review,
                        repo=args.repo,
                        pr_number=args.pr,
                        token=os.environ["GITHUB_TOKEN"]
                    )
        return 0
    except Exception as exc:
        print(f"[KIWI CI ERROR] {exc}")
        return 0 if args.ci else 1


if __name__ == "__main__":
    sys.exit(main())
