import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

import {
  claimNextJob,
  completeJob,
  failJob,
  stopJob,
  updateJobStage,
} from '../../modules/ingestion/ingestion-job.repository.js'

import { processIngestionJob } from '../../modules/ingestion/ingestion.service.js'
import { TorModel } from '../../modules/tor/tor.model.js'
import { seedCategoriesIfEmpty } from '../../scripts/seed-categories.js'
import { log } from '../../lib/logger.js'

const POLL_INTERVAL_MS = 5_000 // 5 seconds

export async function startIngestionWorker(signal: AbortSignal): Promise<void> {
  const workerId = `ingestion-${randomUUID()}`

  await TorModel.init()
  await seedCategoriesIfEmpty()
  log.info(`Ingestion worker started: ${workerId}`)

  while (!signal.aborted) {
    const job = await claimNextJob(workerId)

    if (!job) {
      try {
        await delay(POLL_INTERVAL_MS, undefined, {
          signal,
        })
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          throw error
        }
      }

      continue
    }

    log.info(`Processing ingestion job ${job.id}`)

    try {
      const result = await processIngestionJob(job.toObject(), async (stage) => {
        await updateJobStage(job._id, workerId, stage)
      })

      if (result.type === 'completed') {
        await completeJob(job._id, workerId, result.torId)
        log.info(`Completed job ${job._id}`)
        continue
      }

      await stopJob(job._id, workerId, result.type, result.reason)

      log.info(`Stopped job ${job._id}: ${result.reason}`)
    } catch (error) {
      log.error(`Job ${job._id} failed`, error)

      await failJob(job._id, workerId, job.attempCount, error)
    }
  }

  log.info(`Injestion worker stopped`)
}
