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
  type: 'Start' | 'write_item' | 'Commit' | 'End' | 'CLR' | 'Checkpoint' | 'read_item' | 'Abort'
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
  transactionID: number
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

export interface EndOperation {
  type: 'End'
  transactionID: number
}

export interface AbortOperation {
  type: 'Abort'
  transactionID: number
}

export interface CLROperation {
  LSN: number
  type: 'CLR'
  transactionID: number
  pageID: string
  value: string
}

type OperationTypes =
  | WriteOperation
  | FlushOperation
  | CommitOperation
  | CheckpointOperation
  | ReadOperation
  | EndOperation
  | AbortOperation
  | CLROperation

export interface Operation {
  hidden?: boolean
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
  redoTransactions: TransactionTableItem[]
  message: {
    enabled: boolean
    type: string
    text: string
  }

  constructor() {
    this.currentOperationIdx = 0
    this.disk = {
      pages: [
        { pageID: 'A', pageLSN: null, value: '10' },
        { pageID: 'B', pageLSN: null, value: '20' },
        { pageID: 'C', pageLSN: null, value: '30' },
        { pageID: 'D', pageLSN: null, value: '40' },
        { pageID: 'E', pageLSN: null, value: '50' },
        { pageID: 'F', pageLSN: null, value: '60' }
      ]
    }
    this.log = { entries: [] }
    this.buffer = { pages: [] }
    this.transactionTable = { items: [] }
    this.dirtyPageTable = { items: [] }
    this.operations = {
      items: []
    }
    this.redoTransactions = []
    this.checkpoint = {
      transactionTable: null,
      dirtyPageTable: null,
      nextLSN: 0
    }
    this.message = {
      enabled: false,
      type: '',
      text: ''
    }
  }

  newLogEntry(operation: OperationTypes) {
    switch (operation.type) {
      case 'Write':
        //this.simulateCacheManagement()
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
        //this.simulateCacheManagement()
        this.read(operation)
        break
      case 'End':
        this.end(operation)
        break
      case 'Abort':
        this.abort(operation)
        break
      case 'CLR':
        this.undoEntry(operation)
        break
    }
  }

  write(operation: WriteOperation) {
    this.message = {
      enabled: true,
      type: 'Info',
      text: `Write Ahead Log: Log persistido em Disco com sucesso!`
    }
    const pageLSN =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID && entry.type === 'write_item')
        .map((entry) => entry.LSN)
        .pop() || null

    const prevValue =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID && entry.type === 'read_item')
        .map((entry) => entry.value)
        .pop() || ''

    this.log.entries.forEach((entry) => {
      entry.active = false
      entry.persisted = true
    })
    if (this.log.entries.filter((e) => e.transactionID === operation.transactionID).length === 0) {
      this.log.entries.push({
        active: true,
        persisted: true,
        LSN: this.log.entries.length,
        transactionID: operation.transactionID,
        type: 'Start',
        pageID: ''
      })
    }

    this.log.entries.push({
      active: true,
      persisted: true,
      LSN: this.log.entries.length,
      prevLSN: pageLSN,
      transactionID: operation.transactionID,
      type: 'write_item',
      pageID: operation.pageID,
      value: operation.value,
      prevValue: prevValue
    })
    this.addOperationAtPosition(
      {
        orderID: this.currentOperationIdx + 1,
        hidden: true,
        operation: {
          type: 'Flush',
          pageID: operation.pageID,
          transactionID: operation.transactionID
        }
      },
      this.currentOperationIdx + 1
    )

    // this.operations.items.push({
    //   hidden: true,
    //   orderID: this.operations.items.length + 1,
    //   operation: {
    //     type: 'Flush',
    //     pageID: operation.pageID,
    //     transactionID: operation.transactionID
    //   }
    // })

    this.updateTransactionTable(operation.transactionID)
    this.updateBuffer(operation.pageID)
    this.updateDirtyPageTable(operation.pageID)
    this.currentOperationIdx++
  }

  read(operation: ReadOperation) {
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++
    this.disk.pages.forEach((p, idx) => {
      if (p.pageID === operation.pageID) {
        if (this.buffer.pages.filter((p) => p.pageID === operation.pageID).length === 0) {
          this.buffer.pages.push(this.clone(p))
          return
        } else {
          this.buffer.pages[idx] = this.clone(p)
        }
        return
      }
    })

    if (this.log.entries.filter((e) => e.transactionID === operation.transactionID).length === 0) {
      this.log.entries.push({
        active: true,
        LSN: this.log.entries.length,
        transactionID: operation.transactionID,
        type: 'Start',
        pageID: ''
      })
    }

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      transactionID: operation.transactionID,
      type: 'read_item',
      pageID: operation.pageID,
      value: this.disk.pages.find((p) => p.pageID === operation.pageID)?.value || ''
    })
    this.updateTransactionTable(operation.transactionID)
  }

  commit(operation: CommitOperation) {
    this.transactionTable.items.forEach((transaction) => {
      if (transaction.transactionID === operation.transactionID) {
        transaction.status = 'Consolidada'
      }
    })
    this.log.entries.forEach((entry) => {
      entry.active = false
    })

    const lastLSN = this.log.entries
      .filter((entry) => entry.transactionID === operation.transactionID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      prevLSN: lastLSN,
      transactionID: operation.transactionID,
      type: 'Commit',
      pageID: '',
      persisted: false
    })
  }

  end(operation: EndOperation) {
    //this.simulateCacheManagement()
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      transactionID: operation.transactionID,
      type: 'End',
      pageID: ''
    })
  }

  abort(operation: AbortOperation) {
    // set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      transactionID: operation.transactionID,
      type: 'Abort',
      pageID: ''
    })

    this.transactionTable.items.forEach((transaction) => {
      if (
        transaction.transactionID === operation.transactionID &&
        transaction.status !== 'Consolidada'
      ) {
        transaction.status = 'Abortada'
      }
    })

    // find all write_item log entry for this transactionID

    const entriesToUndo = this.getTransactionEntries(operation.transactionID)

    //for each item in entriesToUndo, do the following:
    // 1. search for the page in this.disk.pages as diskPage
    // 2. search for the page in the this.buffer.pages as bufferPage
    // 3. if the page is in the buffer, update the bufferPage values with diskPage values
    // 4. if the page is not in the buffer, add the page to the buffer

    entriesToUndo.forEach((entry) => {
      const diskPage = this.disk.pages.find((p) => p.pageID === entry.pageID)
      const bufferPage = this.buffer.pages.find((p) => p.pageID === entry.pageID)
      if (bufferPage) {
        bufferPage.pageLSN = diskPage?.pageLSN || null
        bufferPage.value = diskPage?.value || ''
      } else {
        this.buffer.pages.push({
          pageID: diskPage?.pageID || '',
          pageLSN: diskPage?.pageLSN || null,
          value: diskPage?.value || ''
        })
      }
      this.undoEntry(entry, true)
    })

    // entriesToUndo.forEach((entry) => {
    //   this.disk.pages.forEach((page) => {
    //     if (this.buffer.pages.some((p) => p.pageID === page.pageID)) {
    //       this.buffer.pages.forEach((p) => {
    //         p.pageID = page.pageID
    //         p.value = page.value
    //         p.pageLSN = page.pageLSN
    //       })
    //     } else {
    //       if (page.pageID === entry.pageID) {
    //         this.buffer.pages.push({
    //           pageID: page.pageID,
    //           pageLSN: page.pageLSN,
    //           value: page.value
    //         })
    //       }
    //     }
    //   })
    //   this.undoEntry(entry, true)
    // })
  }

  flush(operation: FlushOperation) {
    this.message = {
      enabled: true,
      type: 'Info',
      text: `Dado ${operation.pageID} gravado em partição de disco.`
    }
    // const correspondentLogEntry = this.log.entries.find(
    //   (entry) =>
    //     entry.pageID === operation.pageID &&
    //     entry.type === 'write_item' &&
    //     entry.transactionID === operation.transactionID
    // )

    const currOp = this.getCurrentOperation()
    if (currOp?.type === 'Flush') {
      this.currentOperationIdx++
    }
    if (currOp?.type === 'Flush') {
      this.log.entries.forEach((entry) => {
        entry.active = false
      })
    }
    const page = this.buffer.pages.find((p) => p.pageID === operation.pageID)
    if (page) {
      if (this.disk.pages.filter((p) => p.pageID === operation.pageID).length === 0) {
        this.disk.pages.push(page)
      } else {
        // update the page in the disk with pageLSN and page.value
        this.log.entries.forEach((e) => (e.persisted = true))
        this.disk.pages.forEach((p) => {
          if (p.pageID === operation.pageID) {
            p.pageLSN = page.pageLSN
            p.value = page.value
          }
        })
      }
      // this.buffer.pages = this.buffer.pages.filter((p) => p.pageID !== operation.pageID)
    }
  }

  setCheckpoint() {
    const currOp = this.getCurrentOperation()
    if (currOp?.type === 'Checkpoint') {
      this.log.entries.forEach((entry) => {
        entry.active = false
      })
    }
    this.currentOperationIdx++
    this.checkpoint.nextLSN = this.log.entries.length

    const transactionsToCommit = this.findEndOperationsSinceLastCheckpoint()
    transactionsToCommit.forEach((transaction) => {
      if (transaction !== undefined) {
        this.commit({
          type: 'Commit',
          transactionID: transaction
        })
      }
    })

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      type: 'Checkpoint',
      pageID: '',
      persisted: false
    })

    this.log.entries.forEach((entry) => {
      entry.persisted = true
    })
    this.checkpoint.transactionTable = this.clone(this.transactionTable)
    this.checkpoint.dirtyPageTable = this.clone(this.dirtyPageTable)
  }

  addOperation(operation: Operation) {
    if (this.operations.items.length === 0) {
      operation.orderID = 1
    } else {
      operation.orderID = this.operations.items[this.operations.items.length - 1].orderID + 1
    }
    if (operation.operation.type === 'Commit') {
      this.addOperationAtPosition(
        {
          orderID: this.currentOperationIdx + 1,
          hidden: false,
          operation: {
            type: 'Flush',
            pageID: '',
            transactionID: operation.operation.transactionID
          }
        },
        this.currentOperationIdx + 1
      )
    }
    this.operations.items.push(operation)

    if (operation.operation.type === 'Checkpoint') {
      const transactionsToCommit = this.findEndOperationsSinceLastCheckpoint()
      console.table(transactionsToCommit)
    }
  }

  findEndOperationsSinceLastCheckpoint(): number[] {
    const checkpointIndices: number[] = []
    this.log.entries.forEach((entry, idx) => {
      if (entry.type === 'Checkpoint') {
        checkpointIndices.push(idx)
      }
    })
    let endTransactionLogEntries: LogEntry[] = []
    if (checkpointIndices.length === 0) {
      endTransactionLogEntries = this.log.entries.filter((entry) => entry.type === 'End')
    } else if (checkpointIndices.length === 1) {
      endTransactionLogEntries = this.log.entries.filter(
        (entry, index) => index < checkpointIndices[0] && entry.type === 'End'
      )
    } else {
      endTransactionLogEntries = this.log.entries.filter(
        (entry, index) =>
          index < checkpointIndices[checkpointIndices.length - 1] &&
          index > checkpointIndices[checkpointIndices.length - 2] &&
          entry.type === 'End'
      )
    }
    let transactionsToCommit: number[] = []
    transactionsToCommit = endTransactionLogEntries.map((entry) => entry.transactionID || 0)
    transactionsToCommit = transactionsToCommit.filter((value) => value !== 0)
    return transactionsToCommit
  }

  addOperationAtPosition(operation: Operation, index: number) {
    if (index < 0 || index > this.operations.items.length) {
      return
    }
    this.operations.items.splice(index, 0, operation)
    this.operations.items.forEach((op, idx) => {
      // adiciona 1 a orderID de todas as operações após a operação adicionada
      if (idx >= index) {
        op.orderID++
      }
    })
  }

  apendFlushOperations(transactionID: number) {
    // para cada item em this.operations.items, retorne valores distintos de pageID
    // de todas as operações de escrita de transactionID
    const pages = this.operations.items
      .filter((op) => {
        if (op.operation.type === 'Write' && op.operation.transactionID === transactionID) {
          return true
        } else {
          return false
        }
      })
      .map((op) => {
        if (op.operation.type === 'Write' && op.operation.transactionID === transactionID) {
          return op.operation.pageID
        } else {
          return ''
        }
      })
      .filter((value, index, self) => self.indexOf(value) === index)

    pages.forEach((page) => {
      this.addOperation({
        hidden: true,
        orderID: this.operations.items.length + 1,
        operation: { type: 'Flush', pageID: page, transactionID: transactionID }
      })
    })
  }

  clone(obj: any) {
    return JSON.parse(JSON.stringify(obj))
  }

  getCurrentOperation(): OperationTypes | null {
    if (this.operations.items[this.currentOperationIdx]) {
      return this.operations.items[this.currentOperationIdx].operation
    }
    return null
  }

  updateTransactionTable(transactionID: number, status?: string) {
    const lastLSN = this.log.entries
      .filter((entry) => entry.transactionID === transactionID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]

    const transaction = this.transactionTable.items.find((t) => t.transactionID === transactionID)

    if (transaction) {
      transaction.lastLSN = lastLSN || null
      transaction.status = status || transaction.status
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

  getPendingTransactions(): TransactionTableItem[] {
    const pendingTransactions = this.transactionTable?.items || []
    console.table(this.checkpoint.transactionTable?.items)
    pendingTransactions.forEach((transaction) => {
      if (transaction.status === 'Ativa') {
        transaction.status = 'Abortada'
      }
    })
    return pendingTransactions.filter((transaction) => transaction.status === 'Abortada')
  }

  getTransactionEntries(transactionID: number): LogEntry[] {
    // return all log entries for the transactionID in reverse order
    return this.log.entries
      .filter((entry) => entry.transactionID === transactionID && entry.type === 'write_item')
      .reverse()
  }

  persistLog() {
    this.log.entries.forEach((entry) => {
      entry.persisted = true
    })
  }

  undo() {
    const entriesToUndo: LogEntry[] = []
    this.redoTransactions.forEach((transaction) => {
      entriesToUndo.push(...(this.getTransactionEntries(transaction.transactionID) as LogEntry[]))
    })

    // Ordena entriesToUndo por ordem decrescente de LSN

    entriesToUndo.sort((a, b) => b.LSN - a.LSN)

    // adiciona a log.entries um registro CLR para cada entrada de log a ser desfeita
    entriesToUndo.forEach((entry) => {
      this.transactionTable.items.forEach((transaction) => {
        if (transaction.transactionID === entry.transactionID) {
          transaction.status = 'Abortada'
        }
      })
      this.undoEntry(entry)
    })
  }

  undoEntry(entry: LogEntry, isHidden?: boolean) {
    // Adiciona um registro CLR para a entrada de log a ser desfeita
    this.log.entries.forEach((e) => {
      e.persisted = true
    })
    if (!isHidden) {
      this.log.entries.push({
        persisted: true,
        active: true,
        LSN: this.log.entries.length,
        prevLSN: entry.LSN,
        transactionID: entry.transactionID,
        type: 'CLR',
        pageID: entry.pageID,
        value: entry.prevValue
      })
    }
    // find the page in the disk, update the value and pageLSN to the prevValue and prevLSN
    this.disk.pages.forEach((page) => {
      if (page.pageID === entry.pageID) {
        page.value = entry.prevValue || ''
        page.pageLSN = entry.prevLSN || null
      }
    })
  }

  simulateCacheManagement(): void {
    const currOp = this.operations.items[this.currentOperationIdx].operation
    if (this.isEndOperation(currOp)) {
      this.operations.items.forEach((op) => {
        if (this.isWriteOperation(op.operation)) {
          const localOp: WriteOperation = op.operation
          if (
            localOp.transactionID === currOp.transactionID &&
            this.buffer.pages.some((page) => page.pageID === localOp.pageID)
          ) {
            this.message = {
              enabled: true,
              type: 'Info',
              text: `Write Ahead Log: Log persistido em Disco com sucesso!`
            }
            this.log.entries.forEach((entry) => {
              entry.persisted = true
            })

            this.addOperationAtPosition(
              {
                orderID: this.currentOperationIdx + 1,
                hidden: true,
                operation: {
                  type: 'Flush',
                  pageID: op.operation.pageID,
                  transactionID: op.operation.transactionID
                }
              },
              this.currentOperationIdx + 1
            )
          }
        }
      })
      // TODO: correção do todo foi comentar a linnha abaixo
      //this.log.entries.forEach((entry) => (entry.persisted = true))
    }

    this.buffer.pages.forEach((page) => {
      const logEntry = this.log.entries.find((entry) => entry.LSN === page.pageLSN)
      if (logEntry) {
        const transaction = this.transactionTable.items.find(
          (transaction) => transaction.transactionID === logEntry.transactionID
        )
        if (transaction?.status === 'Ativa' && Math.random() > 0.5) {
          this.log.entries.forEach((entry) => {
            entry.persisted = true
          })

          this.message = {
            enabled: true,
            type: 'Info',
            text: `Write Ahead Log: Log persistido em Disco com sucesso!`
          }

          this.addOperationAtPosition(
            {
              hidden: true,
              orderID: this.currentOperationIdx + 1,
              operation: {
                type: 'Flush',
                pageID: page.pageID,
                transactionID: logEntry.transactionID || 0
              }
            },
            this.currentOperationIdx + 1
          )

          // envio DIRETO
          // this.flush({
          //   type: 'Flush',
          //   pageID: page.pageID,
          //   transactionID: logEntry.transactionID || 0
          // })
        }
      }
    })
  }

  simulateCrash() {
    //this.transactionTable.items = []
    this.operations.items = []
    this.currentOperationIdx = 0
    this.buffer.pages = []
    this.dirtyPageTable.items = []
    console.table(this.log.entries.filter((e) => e.persisted))
    this.log.entries = this.log.entries.filter((entry) => entry.persisted)
  }

  loadCheckpoint() {
    // Recupera checkpoint

    this.dirtyPageTable = this.checkpoint.dirtyPageTable || { items: [] }
  }

  // Método para recuperação após falha
  restart() {
    this.message = {
      enabled: true,
      type: 'Info',
      text: `Recuperação de Falhas: RM_Restart().`
    }
    this.message = {
      enabled: false,
      type: '',
      text: ``
    }

    // Carrega checkpoint
    this.loadCheckpoint()
    // Identifica transações ativas no momento da falha e aquelas que não foram confirmadas
    this.redoTransactions = this.getPendingTransactions()
    // Desfaz alterações das redoTransactions, o seguinte código é executado interativamente no frontend
    this.undo()
    this.log.entries.forEach((e) => (e.persisted = true))
  }

  isEndOperation(operation: OperationTypes): operation is EndOperation {
    return operation.type === 'End'
  }

  isWriteOperation(operation: OperationTypes): operation is WriteOperation {
    return operation.type === 'Write'
  }

  isCheckpointOperation(operation: OperationTypes): operation is CheckpointOperation {
    return operation.type === 'Checkpoint'
  }
}
export default Logging
