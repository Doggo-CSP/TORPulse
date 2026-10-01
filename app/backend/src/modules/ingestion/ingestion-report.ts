import { IngestionJobModel } from './ingestion-job.model.js'

// Order the worker moves a job through (see processIngestionJob).
export const PIPELINE_STAGES = [
  'queued',
  'fetching_details',
  'downloading',
  'extracting_text',
  'classifying',
  'extracting_fields',
  'storing',
] as const

export interface StatusStageCount {
  status: string
  stage: string
  count: number
}

export interface PipelineStage {
  stage: string
  // Jobs that got at least this far, including the ones that stopped here.
  reached: number
  // Jobs whose last known stage is this one and which did not complete.
  stopped: Array<{ status: string; count: number }>
}

export interface PipelineReport {
  total: number
  stages: PipelineStage[]
  completed: number
  // Jobs whose stage is not part of PIPELINE_STAGES.
  unmapped: number
}

export async function fetchStatusStageCounts(): Promise<StatusStageCount[]> {
  const rows = await IngestionJobModel.aggregate<{
    _id: { status: string; stage: string }
    count: number
  }>([{ $group: { _id: { status: '$status', stage: '$currentStage' }, count: { $sum: 1 } } }])

  return rows.map(({ _id, count }) => ({ status: _id.status, stage: _id.stage, count }))
}

export function buildPipelineReport(rows: StatusStageCount[]): PipelineReport {
  const stages: PipelineStage[] = PIPELINE_STAGES.map((stage) => ({
    stage,
    reached: 0,
    stopped: [],
  }))
  let total = 0
  let completed = 0
  let unmapped = 0

  for (const { status, stage, count } of rows) {
    total += count

    if (status === 'completed') {
      completed += count
      for (const node of stages) {
        node.reached += count
      }
      continue
    }

    const index = PIPELINE_STAGES.indexOf(stage as (typeof PIPELINE_STAGES)[number])
    if (index === -1) {
      unmapped += count
      continue
    }

    for (const node of stages.slice(0, index + 1)) {
      node.reached += count
    }

    const stopped = stages[index]!.stopped
    const existing = stopped.find((entry) => entry.status === status)
    if (existing) {
      existing.count += count
    } else {
      stopped.push({ status, count })
    }
  }

  for (const node of stages) {
    node.stopped.sort((a, b) => b.count - a.count)
  }

  return { total, stages, completed, unmapped }
}

// A job that has not been picked up yet is "waiting", not "stopped".
const STATUS_LABELS: Record<string, string> = {
  queued: 'waiting',
  processing: 'in progress',
  failed: 'failed',
  skipped: 'skipped',
  rejected: 'rejected',
  review_required: 'needs review',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

const formatNumber = (value: number): string => value.toLocaleString('en-US')

export function renderPipelineHtml(report: PipelineReport, generatedAt = new Date()): string {
  const percent = (value: number): number =>
    report.total === 0 ? 0 : Math.round((value / report.total) * 1000) / 10

  const card = (
    title: string,
    reached: number,
    stopped: PipelineStage['stopped'],
    modifier = '',
  ): string => `
      <div class="card ${modifier}">
        <h2>${escapeHtml(title)}</h2>
        <div class="count">${formatNumber(reached)}</div>
        <div class="bar"><span style="width:${percent(reached)}%"></span></div>
        <div class="pct">${percent(reached)}% of all jobs</div>
        <ul>${stopped
          .map(
            ({ status, count }) =>
              `<li class="chip ${escapeHtml(status)}">${escapeHtml(
                STATUS_LABELS[status] ?? status,
              )} <b>${formatNumber(count)}</b></li>`,
          )
          .join('')}</ul>
      </div>`

  const flow = [
    ...report.stages.map((node) =>
      card(node.stage.replaceAll('_', ' '), node.reached, node.stopped),
    ),
    card('completed', report.completed, [], 'done'),
  ].join('\n      <div class="arrow">&rarr;</div>')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>Ingestion pipeline</title>
  <style>
    body { font: 14px/1.4 system-ui, sans-serif; margin: 24px; color: #1f2933; background: #f5f7fa; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { color: #616e7c; margin-bottom: 20px; }
    .flow { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; padding-bottom: 12px; }
    .arrow { align-self: center; font-size: 22px; color: #9aa5b1; }
    .card { min-width: 150px; background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; padding: 12px; }
    .card.done { border-color: #38a169; }
    .card h2 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #616e7c; }
    .count { font-size: 26px; font-weight: 600; margin: 4px 0; }
    .bar { height: 6px; background: #e4e7eb; border-radius: 3px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: #3182ce; }
    .done .bar span { background: #38a169; }
    .pct { font-size: 11px; color: #7b8794; margin: 4px 0 8px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .chip { border-radius: 4px; padding: 2px 8px; display: flex; justify-content: space-between; gap: 12px; background: #e4e7eb; }
    .chip.failed { background: #fed7d7; color: #9b2c2c; }
    .chip.skipped { background: #e2e8f0; color: #4a5568; }
    .chip.rejected { background: #feebc8; color: #975a16; }
    .chip.review_required { background: #e9d8fd; color: #553c9a; }
    .chip.processing { background: #bee3f8; color: #2a4365; }
    .chip.queued { background: #fefcbf; color: #744210; }
  </style>
</head>
<body>
  <h1>Ingestion pipeline</h1>
  <div class="meta">${formatNumber(report.total)} jobs &middot; generated ${escapeHtml(
    generatedAt.toISOString(),
  )} &middot; refreshes every 30s${
    report.unmapped > 0 ? ` &middot; ${formatNumber(report.unmapped)} jobs at an unknown stage` : ''
  }</div>
  <div class="flow">
${flow}
  </div>
</body>
</html>
`
}
