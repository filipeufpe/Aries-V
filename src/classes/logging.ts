interface DiskPage {
  page: string
  pageLSN: number
  value: string
}
interface Disk {
  pages: DiskPage[] | never
}

interface LogEntry {
  LSN: number
  prevLSN: number
  transactionID: number
  type: 'Update' | 'Commit' | 'End' | 'CLR' | 'Checkpoint'
  pageID: number
}

interface Log {
  entries: LogEntry[] | never
}

interface BufferPage {
  pageID: number
  value: string
  pageLSN: number
}

interface Buffer {
  pages: BufferPage[] | never
}

interface TransactionTableItem {
  transactionID: number
  status: string
  lastLSN: number
}

interface TransactionTable {
  items: TransactionTableItem[] | never
}

interface DirtyPageTableItem {
  pageID: number
  recLSN: number
}

interface DirtyPageTable {
  items: DirtyPageTableItem[] | never
}

interface Checkpoint {
  transactionTable: TransactionTable
  dirtyPageTable: DirtyPageTable
  nextLSN: number
}

interface WriteOperation {
  type: string
  transactionID: number
  pageID: string
  value: string
}

interface FlushOperation {
  type: string
  pageID: string
}

interface CommitOperation {
  type: string
  transactionID: number
}

interface CheckpointOperation {
  type: string
}

interface Operation {
  orderID: number | never
  operation: WriteOperation | FlushOperation | CommitOperation | CheckpointOperation
}

interface Operations {
  items: Operation[] | never
}

class Logging {
  disk: Disk
  log: Log
  buffer: Buffer
  transactionTable: TransactionTable
  dirtyPageTable: DirtyPageTable
  checkpoint: Checkpoint
  operations: Operations

  constructor() {
    this.disk = { pages: [{ page: '', pageLSN: 0, value: '' }] }
    this.log = {
      entries: [
        {
          LSN: 0,
          prevLSN: 0,
          transactionID: 0,
          type: 'Update',
          pageID: 0
        }
      ]
    }
    this.buffer = { pages: [{ pageID: 0, value: '', pageLSN: 0 }] }
    this.transactionTable = { items: [{ transactionID: 0, status: 'Consolidada', lastLSN: 0 }] }
    this.dirtyPageTable = { items: [{ pageID: 0, recLSN: 0 }] }
    this.checkpoint = {
      transactionTable: this.transactionTable,
      dirtyPageTable: this.dirtyPageTable,
      nextLSN: 0
    }
    this.operations = { items: [] }
  }

  write(pageID: number, value: string) {
    const pageLSN = this.checkpoint.nextLSN
    this.checkpoint.nextLSN += 1
    // this.operations.items.push({ type: 'Write', pageID, value })
    this.buffer.pages.push({ pageID, value, pageLSN })
  }

  commit(transactionID: number) {
    const lastLSN = this.checkpoint.nextLSN
    this.checkpoint.nextLSN += 1
    // this.operations.items.push({ type: 'Commit', pageID: transactionID, value: '' })
    this.transactionTable.items.push({ transactionID, status: 'Consolidada', lastLSN })
  }

  flush(pageID: number) {
    const page = this.buffer.pages.find((p) => p.pageID === pageID)
    if (page) {
      const recLSN = this.checkpoint.nextLSN
      this.checkpoint.nextLSN += 1
      // this.operations.items.push({ type: 'Flush', pageID, value: page.value })
      this.disk.pages.push({ page: page.value, pageLSN: page.pageLSN, value: page.value })
      this.dirtyPageTable.items.push({ pageID, recLSN })
    }
  }

  setCheckpoint() {
    const recLSN = this.checkpoint.nextLSN
    this.checkpoint.nextLSN += 1
    // this.operations.items.push({ type: 'Checkpoint', pageID: 0, value: '' })
    this.checkpoint.transactionTable = this.transactionTable
    this.checkpoint.dirtyPageTable = this.dirtyPageTable
  }

  addOperation(operation: Operation, operations: Operations) {
    if (operations.items.length === 0) {
      operation.orderID = 1
    } else {
      operation.orderID = operations.items[operations.items.length - 1].orderID + 1
    }
    operations.items.push(operation)
  }
}

export default Logging
