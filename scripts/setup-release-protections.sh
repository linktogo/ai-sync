#!/usr/bin/env bash
# One-time setup for the two @linktogo release gates. Run by hand, once.
# Requires repo-admin `gh` auth.
#
# `linktogo` is a personal GitHub account, not an organization, so there is
# no Teams feature to gate on: the environment reviewer is the `linktogo`
# user directly, and tag creation is restricted to the repository's Admin
# role (which today only `linktogo` holds).
set -euo pipefail

OWNER="linktogo"
REPO="ai-sync"
USER="linktogo"
ENVIRONMENT="npm-publish"

echo "Looking up user $USER..."
USER_ID="$(gh api "users/$USER" --jq .id)" || {
  echo "User '$USER' was not found (or is not visible to your token)." >&2
  exit 1
}
echo "Found user id $USER_ID"

echo "Configuring environment '$ENVIRONMENT' with $USER as required reviewer..."
echo "{\"reviewers\":[{\"type\":\"User\",\"id\":$USER_ID}]}" \
  | gh api --method PUT "repos/$OWNER/$REPO/environments/$ENVIRONMENT" --input - >/dev/null
echo "Environment configured — only $USER can approve a run using it."

echo "Configuring tag ruleset restricting v* tag creation to the repository Admin role..."
gh api --method POST "repos/$OWNER/$REPO/rulesets" --input - >/dev/null <<'JSON'
{
  "name": "release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [{ "type": "creation" }],
  "bypass_actors": [
    { "actor_type": "RepositoryRole", "actor_id": 5, "bypass_mode": "always" }
  ]
}
JSON
echo "Ruleset configured — only accounts with the Admin role (today: $USER) can create v* tags."

echo "Done. Verify under Settings > Environments and Settings > Rules on the repo."
