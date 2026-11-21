<!-- ci:begin (managed by vctrchappot/ci scripts/onboard.sh) -->

## CI

This repository runs its checks through the shared pipeline in `vctrchappot/ci` (`.github/workflows/ci.yml` calls it).

- Run the checks locally before you push; do not rely on CI to find problems. `gh api repos/vctrchappot/ci/contents/scripts/local.sh --jq .content | base64 -d | bash -s --` runs only the suites this change needs (add `--dry-run` to see the plan). A local pass does not replace `ci / check`.
- Push once per goal. Open pull requests as drafts and mark them ready when the work is done: drafts cost no CI minutes.
- Which suites run is decided by `.github/ci.json` (path groups and critical paths). A file or folder nobody classified runs everything; add it to a suite there.
- Do not edit the shared workflow logic in this repository. Change `.github/ci.json` or the commands in `.github/workflows/ci.yml`, or change `vctrchappot/ci`.
- Label `ci:full` (or the repository variable `CI_FULL=1`) forces every suite. The result to require on a branch is `ci / check`.
<!-- ci:end -->
