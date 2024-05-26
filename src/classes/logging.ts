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
  type: 'Start' | 'write_item' | 'Commit' | 'End' | 'CLR' | 'Checkpoint' | 'read_item'
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
  redoTransactions: TransactionTableItem[]

  constructor() {
    this.currentOperationIdx = 0
    this.disk = { pages: [] }
    this.log = { entries: [] }
    this.buffer = { pages: [] }
    this.transactionTable = { items: [] }
    this.dirtyPageTable = { items: [] }
    this.operations = {
      items: [
        { orderID: 1, operation: { type: 'Write', transactionID: 1, pageID: 'Preço', value: '1' } },
        { orderID: 2, operation: { type: 'Write', transactionID: 1, pageID: 'Preço', value: '2' } },
        { orderID: 3, operation: { type: 'Write', transactionID: 2, pageID: 'Preço', value: '3' } },
        { orderID: 4, operation: { type: 'Commit', transactionID: 1 } },
        { orderID: 5, operation: { type: 'Write', transactionID: 2, pageID: 'Preço', value: '4' } },
        { orderID: 6, operation: { type: 'Flush', pageID: 'Preço' } },
        { orderID: 7, operation: { type: 'Read', transactionID: 2, pageID: 'Preço' } },
        { orderID: 8, operation: { type: 'Write', transactionID: 3, pageID: 'Preço', value: '5' } },
        {
          orderID: 9,
          operation: { type: 'Write', transactionID: 3, pageID: 'Preço', value: '75' }
        },
        { orderID: 10, operation: { type: 'Read', transactionID: 3, pageID: 'Preço' } }
      ]
      // items: [
      //   { orderID: 1, operation: { type: 'Write', transactionID: 1, pageID: 'a', value: 'one' } },
      //   { orderID: 2, operation: { type: 'Write', transactionID: 1, pageID: 'b', value: 'two' } },
      //   { orderID: 3, operation: { type: 'Flush', pageID: 'b' } },
      //   { orderID: 4, operation: { type: 'Write', transactionID: 1, pageID: 'c', value: 'three' } },
      //   { orderID: 5, operation: { type: 'Flush', pageID: 'c' } },
      //   { orderID: 6, operation: { type: 'Checkpoint' } },
      //   { orderID: 7, operation: { type: 'Write', transactionID: 1, pageID: 'd', value: 'four' } },
      //   { orderID: 8, operation: { type: 'Write', transactionID: 1, pageID: 'a', value: 'five' } },
      //   { orderID: 9, operation: { type: 'Commit', transactionID: 1 } },
      //   { orderID: 10, operation: { type: 'Write', transactionID: 1, pageID: 'c', value: 'six' } },
      //   {
      //     orderID: 11,
      //     operation: { type: 'Write', transactionID: 2, pageID: 'd', value: 'seven' }
      //   },
      //   { orderID: 12, operation: { type: 'Flush', pageID: 'd' } },
      //   {
      //     orderID: 13,
      //     iperation: { type: 'Write', transactionID: 2, pageID: 'b', value: 'eight' }
      //   },
      //   { orderID: 14, operation: { type: 'Write', transactionID: 3, pageID: 'a', value: 'nine' } }
      // ]
    }
    this.redoTransactions = []
    this.checkpoint = {
      transactionTable: null,
      dirtyPageTable: null,
      nextLSN: 0
    }
  }

  newLogEntry(operation: OperationTypes) {
    switch (operation.type) {
      case 'Write':
        console.clear()
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
        this.read(operation)
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
        .filter((entry) => entry.pageID === operation.pageID && entry.type === 'write_item')
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
    if (this.log.entries[this.log.entries.length - 2].type === 'Start') {
      console.log(`Como essa é a primeira operação de escrita da transação ${operation.transactionID},
        o log é persistido em disco 
        Dessa forma garantimos que ao falhar, a transação possa ser identificada e desfeita.
      `)
      this.flush({ type: 'Flush', pageID: operation.pageID })
    }
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
          this.buffer.pages.push(p)
          return
        } else {
          console.log(`O dado ${operation.pageID} já está na memória, portanto será atualizado.`)
          this.buffer.pages[idx] = p
        }
        return
      }
    })
    console.log(`
      A transação ${operation.transactionID} leu o dado ${operation.pageID} do disco. 
      E uma entrada do tipo 'read_item' é adicionada ao log.
    `)
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      transactionID: operation.transactionID,
      type: 'read_item',
      pageID: operation.pageID
    })
  }

  commit(operation: CommitOperation) {
    // set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    // remova a transação da transactionTable
    this.transactionTable.items = this.transactionTable.items.filter(
      (t) => t.transactionID !== operation.transactionID
    )
    // the LSN of the last log.entry for this transaction
    const lastLSN = this.log.entries
      .filter((entry) => entry.transactionID === operation.transactionID)
      .map((entry) => entry.LSN)
      .slice(-1)[0]
    // adicione um log de commit
    console.log(
      `A transação ${operation.transactionID} foi consolidada. Uma entrada do tipo 'Commit' é adicionada ao log.`
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

    // adicione um log de end
    console.log(
      `Além disso, uma entrada do tipo 'End' é adicionada ao log, para indicar que a transação foi finalizada.`
    )
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
      console.log(
        `Como estamos utilizando o algoritmo de recuperação imediata, precisamos garantir que todas as entradas do log sejam persistidas.`
      )
      entry.persisted = true
    })

    console.log(
      `Também precisamos garantir que todos os dados alterados pela transação ${operation.transactionID} sejam persistidos no disco.`
    )
    this.log.entries
      .filter((entry) => entry.transactionID === operation.transactionID)
      .forEach((entry) => {
        this.flush({ type: 'Flush', pageID: entry.pageID })
      })
    console.log(
      `Por fim, a transação ${operation.transactionID} é removida da tabela de transações. E um Checkpoint é realizado.`
    )
    this.setCheckpoint()
  }

  flush(operation: FlushOperation) {
    //set all log entries to be inactive
    this.log.entries.forEach((entry) => {
      entry.active = false
    })
    const currOp = this.getCurrentOperation()
    if (currOp?.type === 'Flush') {
      this.currentOperationIdx++
    }
    const page = this.buffer.pages.find((p) => p.pageID === operation.pageID)
    if (page) {
      this.log.entries.forEach((entry) => {
        entry.persisted = true
      })
      if (this.disk.pages.filter((p) => p.pageID === operation.pageID).length === 0) {
        console.log(`O dado ${operation.pageID} não existe no disco, portanto será adicionado.`)
        this.disk.pages.push(page)
      } else {
        // update the page in the disk with pageLSN and page.value
        console.log(`O dado ${operation.pageID} já existe no disco, portanto será atualizado.`)
        this.disk.pages.forEach((p) => {
          if (p.pageID === operation.pageID) {
            p.pageLSN = this.log.entries[this.log.entries.length - 1].LSN
            p.value = page.value
          }
        })
      }

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
    this.checkpoint.nextLSN = this.log.entries.length
    console.log(
      `Ao realizar um CheckPoint, uma cópia da tabela de transações é feita.
      Bem como uma cópia da tabela de dados alterados em memória`
    )
    this.checkpoint.transactionTable = this.clone(this.transactionTable)
    this.checkpoint.dirtyPageTable = this.clone(this.dirtyPageTable)
    // add a log.entry for this checkpoint
    console.log(`E uma entrada do tipo 'Checkpoint' é adicionada ao log.`)
    this.log.entries.push({
      active: true,
      LSN: this.log.entries.length,
      type: 'Checkpoint',
      pageID: '',
      persisted: false
    })
    //persist all log entries
    this.log.entries.forEach((entry) => {
      entry.persisted = true
    })
  }

  addOperation(operation: Operation) {
    if (this.operations.items.length === 0) {
      operation.orderID = 1
    } else {
      operation.orderID = this.operations.items[this.operations.items.length - 1].orderID + 1
    }
    this.operations.items.push(operation)
    if (operation.operation.type === 'Write') {
      const page = operation.operation.pageID
      if (this.disk.pages.filter((p) => p.pageID === page).length === 0) {
        this.disk.pages.push({ pageID: page, pageLSN: null, value: '' })
      }
    }
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

  updateTransactionTable(transactionID: number) {
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
    // activeTransactions = all active transactions in the transactionTable
    const activeTransactions = this.transactionTable.items.filter(
      (transaction) => transaction.status === 'Ativa'
    )

    // search in log.entries for transactions that have a start but not an end and return their transactionID
    const pendingTransactions = this.log.entries
      .filter((entry) => entry.type === 'Start')
      .map((entry) => entry.transactionID)
      .filter(
        (transactionID) =>
          this.log.entries.filter(
            (entry) => entry.transactionID === transactionID && entry.type === 'End'
          ).length === 0
      )

      // for each transaction in pendingTransactions, build a transactionTableItem
      .map((transactionID) => {
        return {
          transactionID,
          status: 'Pendente',
          lastLSN: this.log.entries
            .filter((entry) => entry.transactionID === transactionID)
            .map((entry) => entry.LSN)
            .slice(-1)[0]
        }
      }) as TransactionTableItem[]
    return [...activeTransactions, ...pendingTransactions]
  }

  getTransactionEntries(transactionID: number): LogEntry[] {
    // return all log entries for the transactionID in reverse order
    return this.log.entries
      .filter((entry) => entry.transactionID === transactionID && entry.type === 'write_item')
      .reverse()
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

  simulateCrash() {
    console.log(`
    Uma falha aconteceu. Seja por falha de energia ou outro motivo.
    Isso significa que os dados da tabela de transações e da tabela de dados alterados em memória foram perdidos.
    Além disso, todas as entradas do log que não foram persistidas também foram perdidas.
    `)
    this.transactionTable.items = []
    this.buffer.pages = []
    this.dirtyPageTable.items = []
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
  recover() {
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
}
export default Logging
