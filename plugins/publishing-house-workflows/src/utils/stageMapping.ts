import { WorkflowNode, WorkflowStage } from '../api/types';

const STATE_MAP: Record<string, WorkflowStage> = {
  preintake: 'pre_intake',
  preintakeinitialcomplete: 'pre_intake',
  preintakeawaitupdate: 'pre_intake',
  preintakereview: 'pre_intake_review',
  preintakereviewdecision: 'pre_intake_review',
  createepic: 'pre_intake',
  updateepic: 'intake',
  createrepo: 'intake',
  waitforrepo: 'intake',
  intake: 'intake',
  contentreview: 'content_review',
  contentreviewdecision: 'content_review',
  infrareview: 'infra_review',
  infrareviewdecision: 'infra_review',
  jirasync: 'jira_sync',
  envsetup: 'env_setup',
  development: 'development',
  testing: 'testing',
  published: 'published',
};

export function deriveStage(
  nodes: WorkflowNode[],
  processState: string,
): WorkflowStage {
  if (processState === 'COMPLETED') return 'published';
  if (processState === 'ERROR') return 'error';

  let best: WorkflowStage = 'intake';
  let latestEnter = '';

  for (const node of nodes) {
    if (node.type !== 'CompositeContextNode') continue;
    if (!node.enter || node.exit) continue;
    const candidate = STATE_MAP[node.name.toLowerCase()];
    if (candidate && node.enter > latestEnter) {
      best = candidate;
      latestEnter = node.enter;
    }
  }
  return best;
}

export const STAGE_ORDER: WorkflowStage[] = [
  'pre_intake',
  'pre_intake_review',
  'intake',
  'content_review',
  'infra_review',
  'env_setup',
  'development',
  'testing',
  'published',
];

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  init: 'Init',
  setup: 'Setup',
  pre_intake: 'Pre-Intake',
  pre_intake_review: 'Pre-Intake Review',
  intake: 'Intake',
  review: 'Reviews',
  content_review: 'Content Review',
  infra_review: 'Infra Review',
  jira_sync: 'Jira Sync',
  env_setup: 'Env Setup',
  development: 'Development',
  testing: 'Testing',
  published: 'Published',
  error: 'Error',
};

export const STAGE_DESCRIPTIONS: Record<string, string> = {
  pre_intake: 'Onboarding details submission. Completed on first run, active when updates are needed after rejection.',
  pre_intake_review: 'Initial onboarding request is under review. Reviewer will approve, reject (send back for updates), or cancel (terminate).',
  intake: 'The project spec, design document, and module outlines are being authored via the intake skill.',
  content_review: 'The design spec and module outlines are being reviewed for completeness and accuracy. A reviewer must approve or reject before proceeding.',
  infra_review: 'Infrastructure requirements (cluster type, sizing, workloads) are being reviewed. A reviewer must approve or reject before proceeding.',
  env_setup: 'An RHDP content developer is setting up the base catalog item and CI environment for this project.',
  development: 'Lab content is being developed. The author is writing the actual lab modules and showroom content.',
  testing: 'Development is complete. The project is undergoing testing before release.',
  published: 'The project has been published to the RHDP catalog and is available to users.',
  error: 'The workflow encountered an error. Check the Orchestrator logs for details.',
};

export function stageIndex(stage: WorkflowStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : 0;
}
