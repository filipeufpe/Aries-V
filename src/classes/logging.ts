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

type OperationTypes =
  | WriteOperation
  | FlushOperation
  | CommitOperation
  | CheckpointOperation
  | ReadOperation
  | EndOperation
  | AbortOperation

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
        { pageID: 'E', pageLSN: null, value: '50' }
      ]
    }
    this.log = { entries: [] }
    this.buffer = { pages: [] }
    this.transactionTable = { items: [] }
    this.dirtyPageTable = { items: [] }
    this.operations = {
      items: [
        // 5 read operations, 1 for each transaction and pageId
        { orderID: 1, operation: { type: 'Read', transactionID: 1, pageID: 'A' } },
        { orderID: 2, operation: { type: 'Read', transactionID: 2, pageID: 'B' } },
        { orderID: 3, operation: { type: 'Read', transactionID: 3, pageID: 'C' } },
        { orderID: 4, operation: { type: 'Read', transactionID: 4, pageID: 'D' } },
        { orderID: 5, operation: { type: 'Read', transactionID: 5, pageID: 'E' } },
        //add 10 write operations
        { orderID: 6, operation: { type: 'Write', transactionID: 1, pageID: 'A', value: '11' } },
        { orderID: 7, operation: { type: 'Write', transactionID: 2, pageID: 'B', value: '21' } },
        { orderID: 8, operation: { type: 'Write', transactionID: 3, pageID: 'C', value: '31' } },
        { orderID: 9, operation: { type: 'Write', transactionID: 4, pageID: 'D', value: '41' } },
        { orderID: 10, operation: { type: 'Write', transactionID: 5, pageID: 'E', value: '51' } },
        { orderID: 11, operation: { type: 'Write', transactionID: 1, pageID: 'A', value: '12' } },
        { orderID: 12, operation: { type: 'Write', transactionID: 2, pageID: 'B', value: '22' } },
        { orderID: 13, operation: { type: 'Write', transactionID: 3, pageID: 'C', value: '32' } },
        { orderID: 14, operation: { type: 'Write', transactionID: 4, pageID: 'D', value: '42' } },
        { orderID: 15, operation: { type: 'Write', transactionID: 5, pageID: 'E', value: '52' } },
        { orderID: 16, operation: { type: 'End', transactionID: 1 } },
        { orderID: 17, operation: { type: 'End', transactionID: 2 } },
        { orderID: 18, operation: { type: 'Abort', transactionID: 3 } },
        { orderID: 19, operation: { type: 'Abort', transactionID: 4 } }
      ]
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
        console.clear()
        this.simulateCacheManagement()
        this.write(operation)
        break
      case 'Flush':
        console.clear()
        this.flush(operation)
        break
      case 'Commit':
        console.clear()
        this.commit(operation)
        break
      case 'Checkpoint':
        console.clear()
        this.setCheckpoint()
        break
      case 'Read':
        console.clear()
        this.simulateCacheManagement()
        this.read(operation)
        break
      case 'End':
        console.clear()
        this.simulateCacheManagement()
        this.end(operation)
        break
      case 'Abort':
        console.clear()
        this.simulateCacheManagement()
        this.abort(operation)
        break
    }
  }

  write(operation: WriteOperation) {
    const pageLSN =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID && entry.type === 'write_item')
        .map((entry) => entry.LSN)
        .pop() || null
    // get the entry.value of the last log entry for this page
    const prevValue =
      this.log.entries
        .filter((entry) => entry.pageID === operation.pageID && entry.type === 'read_item')
        .map((entry) => entry.value)
        .pop() || ''

    this.log.entries.forEach((entry) => {
      entry.active = false
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
      prevLSN: pageLSN,
      transactionID: operation.transactionID,
      type: 'write_item',
      pageID: operation.pageID,
      value: operation.value,
      prevValue: prevValue
    })

    this.updateTransactionTable(operation.transactionID)
    this.updateBuffer(operation.pageID)
    this.updateDirtyPageTable(operation.pageID)
    this.currentOperationIdx++
    // explain the logic behind this in a console.log output
    console.log(
      `A transação ${operation.transactionID} escreveu no dado ${operation.pageID} o valor ${operation.value}`
    )
  }

  read(operation: ReadOperation) {
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++
    this.disk.pages.forEach((p, idx) => {
      if (p.pageID === operation.pageID) {
        if (this.buffer.pages.filter((p) => p.pageID === operation.pageID).length === 0) {
          console.log(`O dado ${operation.pageID} não está na memória, portanto será adicionado.`)
          this.buffer.pages.push(this.clone(p))
          return
        } else {
          console.log(`O dado ${operation.pageID} já está na memória, portanto será atualizado.`)
          this.buffer.pages[idx] = p
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
    console.log(`
      A transação ${operation.transactionID} leu o dado ${operation.pageID} do disco. 
      E uma entrada do tipo 'read_item' é adicionada ao log.
    `)
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

    console.log(
      `A transação ${operation.transactionID} foi consolidada. Uma entrada do tipo 'Commit' é adicionada ao log.`
    )

    console.log(
      `Além disso, uma entrada do tipo 'End' é adicionada ao log, para indicar que a transação foi finalizada.`
    )

    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      prevLSN: lastLSN,
      transactionID: operation.transactionID,
      type: 'Commit',
      pageID: '',
      persisted: false
    })
    //this.currentOperationIdx++
  }

  end(operation: EndOperation) {
    // set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    this.currentOperationIdx++
    // remove transaction from transactionTable
    //    this.transactionTable.items = this.transactionTable.items.filter(
    //(t) => t.transactionID !== operation.transactionID
    //)
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
    // remove transaction from transactionTable
    //    this.transactionTable.items = this.transactionTable.items.filter(
    //(t) => t.transactionID !== operation.transactionID
    //)
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
  }

  flush(operation: FlushOperation) {
    //set all log entries to be inactive

    const correspondentLogEntry = this.log.entries.find(
      (entry) =>
        entry.pageID === operation.pageID &&
        entry.type === 'write_item' &&
        entry.transactionID === operation.transactionID
    )

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
        console.log(`O dado ${operation.pageID} não existe no disco, portanto será adicionado.`)
        this.disk.pages.push(page)
      } else {
        // update the page in the disk with pageLSN and page.value
        console.log(`O dado ${operation.pageID} já existe no disco, portanto será atualizado.`)
        this.disk.pages.forEach((p) => {
          if (p.pageID === operation.pageID) {
            p.pageLSN = correspondentLogEntry?.LSN || null
            p.value = page.value
          }
        })
      }

      // this.dirtyPageTable.items = this.dirtyPageTable.items.filter(
      //   (p) => p.pageID !== operation.pageID
      // )
      this.buffer.pages = this.buffer.pages.filter((p) => p.pageID !== operation.pageID)
    }
  }

  setCheckpoint() {
    // set all log entries to be inactive
    const currOp = this.getCurrentOperation()
    if (currOp?.type === 'Checkpoint') {
      this.log.entries.forEach((entry) => {
        entry.active = false
      })
    }
    this.currentOperationIdx++
    this.checkpoint.nextLSN = this.log.entries.length
    console.log(
      `Ao realizar um CheckPoint, uma cópia da tabela de transações é feita.
      Bem como uma cópia da tabela de dados alterados em memória`
    )

    // add a log.entry for this checkpoint
    console.log(`E uma entrada do tipo 'Checkpoint' é adicionada ao log.`)
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      type: 'Checkpoint',
      pageID: '',
      persisted: false
    })
    const transactionsToCommit = this.findEndOperationsSinceLastCheckpoint()
    transactionsToCommit.forEach((transaction) => {
      if (transaction !== undefined) {
        this.commit({
          type: 'Commit',
          transactionID: transaction
        })
      }
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
    this.operations.items.push(operation)

    if (operation.operation.type === 'Checkpoint') {
      const transactionsToCommit = this.findEndOperationsSinceLastCheckpoint()
      console.table(transactionsToCommit)
    }
  }

  findEndOperationsSinceLastCheckpoint() {
    // Encontra o índice do último "Checkpoint"
    let lastCheckpointIndex = this.operations.items.length - 1
    while (
      lastCheckpointIndex >= 0 &&
      this.operations.items[lastCheckpointIndex].operation.type !== 'Checkpoint'
    ) {
      lastCheckpointIndex--
    }

    // Se nenhum "Checkpoint" for encontrado, retorna todos os "End"
    if (lastCheckpointIndex < 0) {
      return this.operations.items.map((item) => {
        if (item.operation.type === 'End') {
          return item.operation.transactionID
        }
      })
    }

    // Encontra o índice do "Checkpoint" que o precede
    let checkpointAnteriorIndex = lastCheckpointIndex - 1
    while (
      checkpointAnteriorIndex >= 0 &&
      this.operations.items[checkpointAnteriorIndex].operation.type !== 'Checkpoint'
    ) {
      checkpointAnteriorIndex--
    }

    // Retorna os "End" entre os dois "Checkpoint"
    return this.operations.items
      .slice(checkpointAnteriorIndex + 1, lastCheckpointIndex)
      .map((item) => {
        if (item.operation.type === 'End') {
          return item.operation.transactionID
        }
      })
  }

  addOperationAtPosition(operation: Operation, index: number) {
    if (index < 0 || index > this.operations.items.length) {
      console.log(`A posição ${index} não é válida.`)
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
    console.log('rodou')
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
      console.log(
        `A transação ${transactionID} já existe na tabela de transações e será atualizada. 
        A última linha de log que referencia essa transação é ${lastLSN}, esse valor é inserido na tabela de transações.`
      )
      transaction.lastLSN = lastLSN || null
      transaction.status = status || transaction.status
    } else {
      console.log(
        `A transação ${transactionID} não existe na tabela de transações e será adicionada. Uma entrada do tipo START é adicionada ao log.`
      )
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
      console.log(
        `O dado ${pageID} foi alterado em memória. Uma entrada em dirtyPageTable é adicionada para indicar isso.`
      )
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
      console.log(
        `O dado ${pageID} já existe na memória e será atualizado, com o valor ${value}. O LSN é atualizado para ${pageLSN}`
      )
    } else {
      console.log(
        `O dado ${pageID} não existe na memória e será adicionado, com o valor ${value}. O LSN do dado é ${pageLSN}`
      )
      this.buffer.pages.push({ pageID, pageLSN, value: value || '' })
    }
  }

  getPendingTransactions(): TransactionTableItem[] {
    const pendingTransactions = this.checkpoint.transactionTable?.items || []
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
      console.log(`A transação ${transaction.transactionID} foi abortada.`)
      entriesToUndo.push(...(this.getTransactionEntries(transaction.transactionID) as LogEntry[]))
    })

    // Ordena entriesToUndo por ordem decrescente de LSN
    console.log(`As entradas de log a serem desfeitas são ordenadas por ordem decrescente de LSN.`)
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

  undoEntry(entry: LogEntry) {
    // Adiciona um registro CLR para a entrada de log a ser desfeita
    console.log(
      `Uma entrada do tipo CLR (Compensation Log Record) é adicionada ao log para desfazer a operação
      de escrita da transação ${entry.transactionID} no dado ${entry.pageID}. Essa operação reverte o valor
      de ${entry.value} para ${entry.prevValue}.`
    )
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      prevLSN: entry.LSN,
      transactionID: entry.transactionID,
      type: 'CLR',
      pageID: entry.pageID,
      value: entry.prevValue
    })
    // find the page in the disk, update the value and pageLSN to the prevValue and prevLSN
    this.disk.pages.forEach((page) => {
      if (page.pageID === entry.pageID) {
        console.log(`O dado ${entry.pageID} no disco é atualizado para o valor ${entry.prevValue}`)
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
          if (op.operation.transactionID === currOp.transactionID) {
            this.appendMessage(
              `O Gerenciador de Cache gravou o dado ${op.operation.pageID} no disco.\n`
            )
            this.flush({
              type: 'Flush',
              pageID: op.operation.pageID,
              transactionID: op.operation.transactionID
            })
          }
        }
      })
      this.showMessage()
    }

    this.buffer.pages.forEach((page) => {
      const logEntry = this.log.entries.find((entry) => entry.LSN === page.pageLSN)
      if (logEntry) {
        const transaction = this.transactionTable.items.find(
          (transaction) => transaction.transactionID === logEntry.transactionID
        )
        if (transaction?.status === 'Ativa' && Math.random() > 0.5) {
          console.log(`O dado ${page.pageID} foi alterado em memória e será persistido no disco.`)
          this.appendMessage(`O gerenciador de Cache gravou o dado ${page.pageID} no disco.\n`)
          this.flush({
            type: 'Flush',
            pageID: page.pageID,
            transactionID: logEntry.transactionID || 0
          })
        }
      }
    })
    this.showMessage()
  }

  simulateCrash() {
    console.log(`
    Uma falha aconteceu. Seja por falha de energia ou outro motivo.
    Isso significa que os dados da tabela de transações e da tabela de dados alterados em memória foram perdidos.
    Além disso, todas as entradas do log que não foram persistidas também foram perdidas.
    `)
    this.transactionTable.items = []
    this.buffer.pages = []
    this.dirtyPageTable.items = []
    console.table(this.log.entries.filter((e) => e.persisted))
    this.log.entries = this.log.entries.filter((entry) => entry.persisted)
  }

  loadCheckpoint() {
    // Recupera checkpoint
    console.log(`
    Ao recuperar de uma falha, o checkpoint é carregado.
    Os dados da tabela de transações e da tabela de dados alterados em memória são recuperados.
    Além disso o log é avaliado e as transações ativas (que contém um start) e 
    não confirmadas (ou seja, sem o end correspondente) são identificadas.
    `)
    this.transactionTable.items = this.getPendingTransactions()
    this.dirtyPageTable = this.checkpoint.dirtyPageTable || { items: [] }
  }

  // Método para recuperação após falha
  restart() {
    console.clear()
    // Carrega checkpoint
    this.loadCheckpoint()
    // Identifica transações ativas no momento da falha e aquelas que não foram confirmadas
    this.redoTransactions = this.getPendingTransactions()
    // Desfaz alterações das redoTransactions, o seguinte código é executado interativamente no frontend
    this.undo()
    console.log(
      `Por fim, quando nenhuma das operações de escrita das transações abortadas precisa ser desfeita,
       a recuperação é finalizada.`
    )
  }

  isEndOperation(operation: OperationTypes): operation is EndOperation {
    return operation.type === 'End'
  }

  isWriteOperation(operation: OperationTypes): operation is WriteOperation {
    return operation.type === 'Write'
  }

  setMessage(message: string, tipo?: string) {
    if (tipo) {
      this.message.type = tipo
    }
    this.message.text = message
  }

  appendMessage(message: string) {
    this.message.text += message
  }

  showMessage() {
    this.message.enabled = true
    console.log(this.message.enabled)
  }

  clearMessage() {
    this.message.enabled = false
    this.message.text = ''
  }
}
export default Logging
