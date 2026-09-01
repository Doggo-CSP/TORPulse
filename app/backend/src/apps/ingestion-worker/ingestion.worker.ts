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

const POLL_INTERVAL_MS = 5_000 // 5 seconds

export async function startIngestionWorker(signal: AbortSignal): Promise<void> {
  const workerId = `ingestion-${randomUUID()}`

  await TorModel.init()
  console.log(`Ingestion worker started: ${workerId}`)

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

    console.log(`Processing ingestion job ${job.id}`)

    try {
      const result = await processIngestionJob(job.toObject(), async (stage) => {
        await updateJobStage(job._id, workerId, stage)
      })

      if (result.type === 'completed') {
        await completeJob(job._id, workerId, result.torId)
        console.log(`Completed job ${job._id}`)
        continue
      }

      await stopJob(job._id, workerId, result.type, result.reason)

      console.log(`Stopped job ${job._id}: ${result.reason}`)
    } catch (error) {
      console.error(`Job ${job._id} failed`, error)

      await failJob(job._id, workerId, job.attempCount, error)
    }
  }

  console.log(`Injestion worker stopped`)
}
