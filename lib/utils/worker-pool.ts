export class WorkerPool {
  public workers: Worker[] = []
  public taskQueue: (() => Promise<any>)[] = []
  private activeTasks: number = 0
  private maxWorkers: number

  constructor(maxWorkers: number) {
    this.maxWorkers = maxWorkers
  }

  // Initialize the pool with the given number of workers
  public init() {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(new URL("./convertWorker.ts", import.meta.url))
      this.workers.push(worker)
    }
  }

  // Add tasks to the queue
  public addTask(task: (worker: Worker) => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async (worker: Worker) => {
        try {
          const result = await task(worker)
          resolve(result) // Return result of the task
        } catch (error) {
          reject(error) // Handle error and reject the promise
        } finally {
          this.activeTasks--
          this.runNext() // Run the next task in the queue
        }
      }

      this.taskQueue.push(() => wrappedTask(this.getNextWorker()))
      this.runNext()
    })
  }

  // Run the next task if a worker is available
  private runNext() {
    if (this.activeTasks < this.maxWorkers && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!
      this.activeTasks++
      task() // Execute the task
    }
  }

  // Get the next available worker using round-robin allocation
  private getNextWorker(): Worker {
    const worker = this.workers[this.activeTasks % this.maxWorkers]
    return worker
  }

  // Terminate all workers once the tasks are complete
  public terminateAll() {
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
  }
}
