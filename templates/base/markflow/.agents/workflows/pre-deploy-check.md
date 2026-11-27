# Pre Deploy Check

Purpose. This file is the SOP to check before a release.
Read when. You are about to deploy.
Do not read when. You only work locally. That does not need a deploy check.

## Steps

1. Run all tests. All must pass.
2. Check the spec acceptance cases. All must pass.
3. Check env vars are set. Do not log real secrets.
4. Check CHANGELOG.md is updated.
5. Deploy only when all checks pass. If one fails, fix it first.
