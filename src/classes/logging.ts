interface DiskPage {
  page: string
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
            value: 'One'
          }
        },
        {
          orderID: 2,
          operation: {
            type: 'Write',
            transactionID: 2,
            pageID: 'B',
            value: 'Two'
          }
        },
        {
          orderID: 3,
          operation: {
            type: 'Flush',
            pageID: 'B'
          }
        },
        {
          orderID: 4,
          operation: {
            type: 'Write',
            transactionID: 1,
            pageID: 'A',
            value: 'Three'
          }
        },
        {
          orderID: 5,
          operation: {
            type: 'Flush',
            pageID: 'A'
          }
        },
        {
          orderID: 6,
          operation: {
            type: 'Commit',
            transactionID: 1
          }
        },
        {
          orderID: 7,
          operation: {
            type: 'Write',
            transactionID: 3,
            pageID: 'C',
            value: 'Four'
          }
        },
        {
          orderID: 8,
          operation: {
            type: 'Flush',
            pageID: 'C'
          }
        },
        {
          orderID: 9,
          operation: {
            type: 'Write',
            transactionID: 2,
            pageID: 'B',
            value: 'Five'
          }
        },
        {
          orderID: 10,
          operation: {
            type: 'Flush',
            pageID: 'B'
          }
        },
        {
          orderID: 11,
          operation: {
            type: 'Commit',
            transactionID: 2
          }
        },
        {
          orderID: 12,
          operation: {
            type: 'Write',
            transactionID: 3,
            pageID: 'C',
            value: 'Six'
          }
        },
        {
          orderID: 13,
          operation: {
            type: 'Flush',
            pageID: 'C'
          }
        },
        {
          orderID: 14,
          operation: {
            type: 'Commit',
            transactionID: 3
          }
        },
        {
          orderID: 15,
          operation: {
            type: 'Checkpoint'
          }
        }
      ]
    }
    this.checkpoint = {
      transactionTable: this.transactionTable,
      dirtyPageTable: this.dirtyPageTable,
      nextLSN: 0
    }
  }

  write(pageID: string, value: string, transactionID: number) {
    // pageLSN recebe o número da última entrada no log que referencia pageID
    const pageLSN =
      this.log.entries
        .filter((entry) => entry.pageID === pageID)
        .map((entry) => entry.LSN)
        .pop() || null

    // caso a página já esteja no buffer, atualiza o valor
    const page = this.buffer.pages.find((p) => p.pageID === pageID)
    // caso a transação exista em this.transactionTable, atualiza o lastLSN, caso contrário, insere

    const transaction = this.transactionTable.items.find((t) => t.transactionID === transactionID)
    if (transaction) {
      transaction.lastLSN = pageLSN
    } else {
      this.transactionTable.items.push({ transactionID, status: 'Ativa', lastLSN: pageLSN })
    }

    // caso a página não esteja na tabela de páginas sujas, insere
    const dirtyPage = this.dirtyPageTable.items.find((p) => p.pageID === pageID)
    if (!dirtyPage) {
      this.dirtyPageTable.items.push({ pageID, recLSN: pageLSN })
    }

    if (page) {
      page.value = value
      page.pageLSN = pageLSN
    } else {
      this.buffer.pages.push({ pageID, value, pageLSN })
    }
  }

  writeLog(transactionID: number, pageID: string, value: string) {
    // prevLSN =  o valor de LSN da última entrada do log que referencia pageID
    const prevLSN =
      this.log.entries
        .filter((entry) => entry.transactionID === transactionID)
        .map((entry) => entry.LSN)
        .pop() || null

    this.checkpoint.nextLSN += 1
    this.log.entries.push({
      LSN: this.log.entries.length + 1,
      prevLSN,
      transactionID,
      type: 'Update',
      pageID
    })
    this.write(pageID, value, transactionID)
  }

  read(pageID: string) {
    const page = this.buffer.pages.find((p) => p.pageID === pageID)
    if (page) {
      return page.value
    }
  }

  commit(transactionID: number) {
    const lastLSN = this.checkpoint.nextLSN
    this.checkpoint.nextLSN += 1
    // this.operations.items.push({ type: 'Commit', pageID: transactionID, value: '' })
    this.transactionTable.items.push({ transactionID, status: 'Consolidada', lastLSN })
  }

  flush(pageID: string) {
    const page = this.buffer.pages.find((p) => p.pageID === pageID)
    if (page) {
      const recLSN = this.checkpoint.nextLSN
      this.checkpoint.nextLSN += 1
      this.log.entries.push({
        LSN: this.log.entries.length + 1,
        prevLSN: page.pageLSN,
        transactionID: 0,
        type: 'CLR',
        pageID
      })
      this.disk.pages.push({ page: page.pageID, pageLSN: page.pageLSN, value: page.value })
      //this.dirtyPageTable.items.push({ pageID, recLSN })
    }
  }

  setCheckpoint() {
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
