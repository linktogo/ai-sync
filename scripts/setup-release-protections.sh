#!/usr/bin/env bash
# One-time setup for the two lk-publish release gates. Run by hand, once,
# after the lk-publish GitHub team exists. Requires repo-admin `gh` auth.
set -euo pipefail

OWNER="linktogo"
REPO="ai-sync"
TEAM="lk-publish"
ENVIRONMENT="npm-publish"

echo "Looking up team $OWNER/$TEAM..."
TEAM_ID="$(gh api "orgs/$OWNER/teams/$TEAM" --jq .id)" || {
  echo "Team '$TEAM' was not found in org '$OWNER' (or is not visible to your token)." >&2
  echo "Create it first, then re-run this script." >&2
  exit 1
}
echo "Found team id $TEAM_ID"

echo "Configuring environment '$ENVIRONMENT' with $TEAM as required reviewer..."
gh api --method PUT "repos/$OWNER/$REPO/environments/$ENVIRONMENT" \
  -f "reviewers[0][type]=Team" \
  -F "reviewers[0][id]=$TEAM_ID" >/dev/null
echo "Environment configured — only $TEAM members can approve a run using it."

echo "Configuring tag ruleset restricting v* tag creation to $TEAM..."
gh api --method POST "repos/$OWNER/$REPO/rulesets" \
  -f "name=release-tags" \
  -f "target=tag" \
  -f "enforcement=active" \
  -f "conditions[ref_name][include][]=refs/tags/v*" \
  -f "rules[0][type]=creation" \
  -f "bypass_actors[0][actor_type]=Team" \
  -F "bypass_actors[0][actor_id]=$TEAM_ID" \
  -f "bypass_actors[0][bypass_mode]=always" >/dev/null
echo "Ruleset configured — only $TEAM can create v* tags."

echo "Done. Verify under Settings > Environments and Settings > Rules on the repo."
