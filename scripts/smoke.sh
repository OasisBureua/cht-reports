#!/usr/bin/env bash
# Wait for the report worker's ECS service to settle, then check its tasks
# are running (requires AWS creds). With expected_image, also fail if the
# service settled on a different image (e.g. the deployment circuit breaker
# rolled the deploy back).
# Usage: ./scripts/smoke.sh [dev|production] [region] [expected_image]
set -euo pipefail

ENV="${1:-dev}"
REGION="${2:-us-east-1}"
EXPECTED_IMAGE="${3:-}"

case "$ENV" in
  dev)        CLUSTER="cht-dev-cluster";      SERVICE="cht-reports-dev" ;;
  production|prod) CLUSTER="cht-platform-cluster"; SERVICE="cht-reports-prod" ;;
  *)
    echo "Usage: ./scripts/smoke.sh [dev|production] [region] [expected_image]"
    exit 1
    ;;
esac

aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION"

read -r RUNNING DESIRED TASK_DEF <<< "$(aws ecs describe-services \
  --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" \
  --query "services[0].[runningCount,desiredCount,deployments[?status=='PRIMARY'] | [0].taskDefinition]" \
  --output text)"
IMAGE="$(aws ecs describe-task-definition --task-definition "$TASK_DEF" --region "$REGION" \
  --query 'taskDefinition.containerDefinitions[0].image' --output text)"

echo "${SERVICE}: ${RUNNING}/${DESIRED} running, ${IMAGE}"

if [ -n "$EXPECTED_IMAGE" ] && [ "$IMAGE" != "$EXPECTED_IMAGE" ]; then
  echo "${SERVICE} settled on ${IMAGE}, expected ${EXPECTED_IMAGE} (deployment rolled back?)."
  exit 1
fi

if [ "$DESIRED" -eq 0 ]; then
  # The dev lightswitch scales the service to 0 outside working hours.
  echo "Desired count is 0; nothing running to check."
  exit 0
fi
if [ "$RUNNING" -lt "$DESIRED" ]; then
  echo "${SERVICE} has fewer tasks running than desired."
  exit 1
fi

echo "Report worker ${SERVICE} is running."
