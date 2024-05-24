interface DiskPage {
  pageID: string
  pageLSN: number | null
  value: string
}
interface Disk {
  pages: DiskPage[] | never
}

interface LogEntry {
  active?: boolean
  LSN: number
  prevLSN?: number | null
  transactionID?: number
  type: 'Update' | 'Commit' | 'End' | 'CLR' | 'Checkpoint' | 'Read'
  pageID: string
  persisted?: boolean
  value?: string
  prevValue?: string
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
        { orderID: 1, operation: { type: 'Write', transactionID: 1, pageID: 'a', value: 'one' } },
        { orderID: 2, operation: { type: 'Write', transactionID: 2, pageID: 'b', value: 'two' } },
        { orderID: 3, operation: { type: 'Flush', pageID: 'b' } },
        { orderID: 4, operation: { type: 'Write', transactionID: 3, pageID: 'c', value: 'three' } },
        { orderID: 5, operation: { type: 'Flush', pageID: 'c' } },
        { orderID: 6, operation: { type: 'Checkpoint' } },
        { orderID: 7, operation: { type: 'Write', transactionID: 2, pageID: 'd', value: 'four' } },
        { orderID: 8, operation: { type: 'Write', transactionID: 1, pageID: 'a', value: 'five' } },
        { orderID: 9, operation: { type: 'Commit', transactionID: 1 } },
        { orderID: 10, operation: { type: 'Write', transactionID: 3, pageID: 'c', value: 'six' } },
        {
          orderID: 11,
          operation: { type: 'Write', transactionID: 2, pageID: 'd', value: 'seven' }
        },
        { orderID: 12, operation: { type: 'Flush', pageID: 'd' } },
        {
          orderID: 13,
          operation: { type: 'Write', transactionID: 2, pageID: 'b', value: 'eight' }
        },
        { orderID: 14, operation: { type: 'Write', transactionID: 3, pageID: 'a', value: 'nine' } }
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

    // get the entry.value of the last log entry for this page
    const prevValue =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID)
        .map((entry) => entry.value)
        .pop() || ''

    this.log.entries.forEach((entry) => {
      entry.active = false
    })

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      prevLSN: pageLSN,
      transactionID: operation.transactionID,
      type: 'Update',
      pageID: operation.pageID,
      value: operation.value,
      prevValue: prevValue
    })

    this.updateTransactionTable(operation.transactionID)
    this.updateDirtyPageTable(operation.pageID)
    this.updateBuffer(operation.pageID)

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
        this.read(operation)
        break
    }
  }

  read(operation: ReadOperation) {
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++
    this.disk.pages.forEach((p, idx) => {
      if (p.pageID === operation.pageID) {
        this.buffer.pages[idx] = p
        return
      }
    })
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      prevLSN: this.log.entries[this.log.entries.length - 1].LSN,
      transactionID: operation.transactionID,
      type: 'Read',
      pageID: operation.pageID
    })
  }

  commit(operation: CommitOperation) {
    // set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
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
      active: true,
      LSN: this.log.entries.length,
      prevLSN: this.log.entries[this.log.entries.length - 1].LSN,
      transactionID: operation.transactionID,
      type: 'Commit',
      pageID: '',
      persisted: false
    })

    // adicione um log de end
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
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
    //set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
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
    // set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++
    this.checkpoint.nextLSN++
    this.checkpoint.transactionTable = this.clone(this.transactionTable)
    this.checkpoint.dirtyPageTable = this.clone(this.dirtyPageTable)
    // add a log.entry for this checkpoint
    this.log.entries.push({
      active: true,
      LSN: this.checkpoint.nextLSN,
      type: 'Checkpoint',
      pageID: '',
      persisted: false
    })
  }

  addOperation(operation: Operation) {
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

  updateTransactionTable(transactionID: number) {
    const lastLSN = this.log.entries
      .filter((entry) => entry.transactionID === transactionID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]

    const transaction = this.transactionTable.items.find((t) => t.transactionID === transactionID)

    if (transaction) {
      transaction.lastLSN = lastLSN || null
    } else {
      this.transactionTable.items.push({
        transactionID,
        status: 'Ativa',
        lastLSN: lastLSN
      })
    }
  }

  updateDirtyPageTable(pageID: string) {
    const recLSN = this.log.entries
      .filter((entry) => entry.pageID === pageID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]

    const dirtyPage = this.dirtyPageTable.items.find((p) => p.pageID === pageID)

    if (!dirtyPage) {
      this.dirtyPageTable.items.push({ pageID, recLSN })
    }
  }

  updateBuffer(pageID: string) {
    // search for the page in the buffer, if it exists, update it with new value and pageLSN = LSN of the last
    // log entry for this page if it doesn't exist, create a new page in the buffer with pageLSN = LSN of the last
    // log entry for this page and value = value of the last log entry for this page
    const pageLSN = this.log.entries
      .filter((entry) => entry.pageID === pageID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]

    const value = this.log.entries
      .filter((entry) => entry.pageID === pageID)
      .map((entry) => entry.value)
      .slice(-1)[0]

    const bufferPage = this.buffer.pages.find((p) => p.pageID === pageID)

    if (bufferPage) {
      bufferPage.pageLSN = pageLSN
      bufferPage.value = value || ''
    } else {
      this.buffer.pages.push({ pageID, pageLSN, value: value || '' })
    }
  }

  undo(transactionID: number) {
    // Filtra entradas de log da transação específica
    const entriesToUndo = this.log.entries.filter(
      (entry) => entry.transactionID === transactionID && entry.type === 'Update'
    )
    // Desfaz cada entrada em ordem inversa
    for (let i = entriesToUndo.length - 1; i >= 0; i--) {
      const entry = entriesToUndo[i]
      // Reverte a alteração
      const page = this.buffer.pages.find((p) => p.pageID === entry.pageID)
      if (page) {
        // Reverte para o valor anterior ou um valor padrão se não houver
        page.value = entry.value || ''
      }
      // Adiciona uma entrada de CLR no log
      this.log.entries.push({
        LSN: this.log.entries.length,
        transactionID: transactionID,
        type: 'CLR',
        pageID: entry.pageID,
        value: page?.value
      })
    }
  }

  // Método para recuperação após falha
  recover() {
    // Identifica transações ativas no momento da falha
    const activeTransactions = this.transactionTable.items.filter((t) => t.status === 'Ativa')
    // Desfaz alterações de cada transação ativa
    for (const transaction of activeTransactions) {
      this.undo(transaction.transactionID)
    }
  }
}
export default Logging
