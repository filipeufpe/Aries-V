interface DiskPage {
  pageID: string
  pageLSN: number | null
  value: string
}
interface Disk {
  pages: DiskPage[] | never
}

interface LogEntry {
  LSN: number
  prevLSN: number | null
  transactionID: number
  type: 'Update' | 'Commit' | 'End' | 'CLR' | 'Checkpoint'
  pageID: string
  persisted?: boolean
  value?: string
}

interface Log {
  entries: LogEntry[] | never
}

interface BufferPage {
  pageID: string
  value: string
  pageLSN: number | null
}

interface Buffer {
  pages: BufferPage[] | never
}

interface TransactionTableItem {
  transactionID: number
  status: string
  lastLSN: number | null
}

interface TransactionTable {
  items: TransactionTableItem[] | never
}

interface DirtyPageTableItem {
  pageID: string
  recLSN: number | null
}

interface DirtyPageTable {
  items: DirtyPageTableItem[] | never
}

interface Checkpoint {
  transactionTable: TransactionTable | null
  dirtyPageTable: DirtyPageTable | null
  nextLSN: number
}

export interface WriteOperation {
  type: 'Write'
  transactionID: number
  pageID: string
  value: string
}

export interface FlushOperation {
  type: 'Flush'
  pageID: string
}

export interface CommitOperation {
  type: 'Commit'
  transactionID: number
}

export interface CheckpointOperation {
  type: 'Checkpoint'
}

export interface ReadOperation {
  type: 'Read'
  transactionID: number
  pageID: string
}

type OperationTypes =
  | WriteOperation
  | FlushOperation
  | CommitOperation
  | CheckpointOperation
  | ReadOperation

export interface Operation {
  orderID: number
  operation: OperationTypes
}

interface Operations {
  items: Operation[]
}

class Logging {
  currentOperationIdx: number
  disk: Disk
  log: Log
  buffer: Buffer
  transactionTable: TransactionTable
  dirtyPageTable: DirtyPageTable
  checkpoint: Checkpoint
  operations: Operations

  constructor() {
    this.currentOperationIdx = 0
    this.disk = { pages: [] }
    this.log = { entries: [] }
    this.buffer = { pages: [] }
    this.transactionTable = { items: [] }
    this.dirtyPageTable = { items: [] }
    this.operations = {
      items: [
        {
          orderID: 1,
          operation: {
            type: 'Write',
            transactionID: 1,
            pageID: 'A',
            value: '1'
          }
        },
        {
          orderID: 2,
          operation: {
            type: 'Write',
            transactionID: 2,
            pageID: 'B',
            value: '2'
          }
        },
        {
          orderID: 3,
          operation: {
            type: 'Write',
            transactionID: 3,
            pageID: 'C',
            value: '3'
          }
        },
        {
          orderID: 4,
          operation: {
            type: 'Commit',
            transactionID: 1
          }
        },
        {
          orderID: 5,
          operation: {
            type: 'Checkpoint'
          }
        },
        {
          orderID: 6,
          operation: {
            type: 'Flush',
            pageID: 'A'
          }
        },
        {
          orderID: 7,
          operation: {
            type: 'Write',
            transactionID: 2,
            pageID: 'B',
            value: '7'
          }
        },
        {
          orderID: 8,
          operation: {
            type: 'Write',
            transactionID: 1,
            pageID: 'A',
            value: '8'
          }
        },
        {
          orderID: 9,
          operation: {
            type: 'Write',
            transactionID: 3,
            pageID: 'A',
            value: '9'
          }
        },
        {
          orderID: 10,
          operation: {
            type: 'Write',
            transactionID: 2,
            pageID: 'C',
            value: '10'
          }
        }
      ]
    }
    this.checkpoint = {
      transactionTable: null,
      dirtyPageTable: null,
      nextLSN: 0
    }
  }

  write(operation: WriteOperation) {
    const pageLSN =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID)
        .map((entry) => entry.LSN)
        .pop() || null

    const page = this.buffer.pages.find((p) => p.pageID === operation.pageID)

    const transaction = this.transactionTable.items.find(
      (t) => t.transactionID === operation.transactionID
    )
    if (transaction) {
      transaction.lastLSN = pageLSN
    } else {
      this.transactionTable.items.push({
        transactionID: operation.transactionID,
        status: 'Ativa',
        lastLSN: pageLSN
      })
    }

    const dirtyPage = this.dirtyPageTable.items.find((p) => p.pageID === operation.pageID)
    if (dirtyPage) {
      dirtyPage.recLSN = pageLSN
    } else {
      this.dirtyPageTable.items.push({ pageID: operation.pageID, recLSN: pageLSN })
    }

    if (page) {
      page.value = operation.value
      page.pageLSN = pageLSN
    } else {
      this.buffer.pages.push({ pageID: operation.pageID, value: operation.value, pageLSN })
    }
    // adiciona operation em this.log.entries
    this.log.entries.push({
      LSN: this.log.entries.length + 1,
      prevLSN: pageLSN,
      transactionID: operation.transactionID,
      type: 'Update',
      pageID: operation.pageID,
      value: operation.value
    })

    this.currentOperationIdx++
  }

  writeLog(operation: OperationTypes) {
    switch (operation.type) {
      case 'Write':
        this.write(operation)
        break
      case 'Flush':
        this.flush(operation)
        break
      case 'Commit':
        this.commit(operation)
        break
      case 'Checkpoint':
        this.setCheckpoint()
        break
      case 'Read':
        console.log(operation.type)
        //this.read(operation.pageID)
        break
    }
    // prevLSN =  o valor de LSN da última entrada do log que referencia pageID
    // const prevLSN =
    //   this.log.entries
    //     .filter((entry) => entry.transactionID === transactionID)
    //     .map((entry) => entry.LSN)
    //     .pop() || null

    // if (this.checkpoint.nextLSN === null) {
    //   this.checkpoint.nextLSN = 1
    // } else {
    //   this.checkpoint.nextLSN += 1
    // }
    // this.log.entries.push({
    //   LSN: this.log.entries.length + 1,
    //   prevLSN,
    //   transactionID,
    //   type: 'Update',
    //   pageID,
    //   value
    // })
  }

  read(pageID: string) {
    this.currentOperationIdx++
    this.disk.pages.forEach((p, idx) => {
      if (p.pageID === pageID) {
        this.buffer.pages[idx] = p
        return
      }
    })
  }

  commit(operation: CommitOperation) {
    if (this.checkpoint.nextLSN === null) {
      this.setCheckpoint()
      this.checkpoint.nextLSN = 1
    } else {
      this.checkpoint.nextLSN += 1
      this.currentOperationIdx++
    }
    // remova a transação da transactionTable
    this.transactionTable.items = this.transactionTable.items.filter(
      (t) => t.transactionID !== operation.transactionID
    )
    // adicione um log de commit
    this.log.entries.push({
      LSN: this.checkpoint.nextLSN,
      prevLSN: this.log.entries[this.log.entries.length - 1].LSN,
      transactionID: operation.transactionID,
      type: 'Commit',
      pageID: '',
      persisted: false
    })

    // adicione um log de end
    this.log.entries.push({
      LSN: this.checkpoint.nextLSN + 1,
      prevLSN: this.log.entries[this.log.entries.length - 1].LSN,
      transactionID: operation.transactionID,
      type: 'End',
      pageID: '',
      persisted: false
    })

    // marque todas as entradas do log como persisted
    this.log.entries.forEach((entry) => {
      entry.persisted = true
    })
  }

  flush(operation: FlushOperation) {
    this.currentOperationIdx++
    const page = this.buffer.pages.find((p) => p.pageID === operation.pageID)
    if (page) {
      if (this.checkpoint.nextLSN === null) {
        this.checkpoint.nextLSN = 1
      } else {
        this.checkpoint.nextLSN += 1
      }
      this.log.entries.forEach((entry) => {
        entry.persisted = true
      })
      this.disk.pages.push(page)
      this.dirtyPageTable.items = this.dirtyPageTable.items.filter(
        (p) => p.pageID !== operation.pageID
      )
      this.buffer.pages = this.buffer.pages.filter((p) => p.pageID !== operation.pageID)
    }
  }

  setCheckpoint() {
    this.currentOperationIdx++
    this.checkpoint.nextLSN++
    this.checkpoint.transactionTable = this.clone(this.transactionTable)
    this.checkpoint.dirtyPageTable = this.clone(this.dirtyPageTable)
  }

  addOperation(operation: Operation) {
    console.log(this)
    if (this.operations.items.length === 0) {
      operation.orderID = 1
    } else {
      operation.orderID = this.operations.items[this.operations.items.length - 1].orderID + 1
    }
    this.operations.items.push(operation)
  }

  clone(obj: any) {
    return JSON.parse(JSON.stringify(obj))
  }

  getCurrentOperation(): OperationTypes {
    return this.operations.items[this.currentOperationIdx].operation
  }
}
export default Logging
