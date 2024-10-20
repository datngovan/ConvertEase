type WorkerMessage = {
  chunk: Blob
  chunkIndex: number
  format: string
  fileType: string
}

export class WorkerPool {
  private workers: Worker[] = []
  private queue: WorkerMessage[] = []
  private results: { [key: number]: Blob } = {}
  private currentWorkerIndex: number = 0
  private totalWorkers: number
  private activeWorkers: number = 0

  constructor(totalWorkers: number, workerScriptPath: string) {
    this.totalWorkers = totalWorkers
    console.log("Hello")
    for (let i = 0; i < totalWorkers; i++) {
      const worker = new Worker(workerScriptPath, { type: "module" })
      worker.onmessage = (e: MessageEvent) => this.handleWorkerMessage(e)
      this.workers.push(worker)
    }
    console.log(totalWorkers)
  }

  private handleWorkerMessage(e: MessageEvent) {
    const { chunkIndex, convertedBlob } = e.data
    this.results[chunkIndex] = convertedBlob
    this.activeWorkers--

    // Process the next task in the queue if available
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift()
      this.processTask(nextTask!)
    }
  }

  private processTask(task: WorkerMessage) {
    const worker = this.workers[this.currentWorkerIndex]
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.totalWorkers
    this.activeWorkers++
    worker.postMessage(task)
  }

  public addTask(task: WorkerMessage) {
    if (this.activeWorkers < this.totalWorkers) {
      this.processTask(task)
    } else {
      this.queue.push(task)
    }
  }

  public getResults() {
    return this.results
  }
}
