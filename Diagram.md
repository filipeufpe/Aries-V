```mermaid
classDiagram
    class Logging {
        +disk: Disk
        +log: Log
        +buffer: Buffer
        +transactionTable: TransactionTable
        +dirtyPageTable: DirtyPageTable
        +checkpoint: Checkpoint
        +operations: Operations
        +constructor()
        +write(pageID: string, value: string, transactionID: number)
        +writeLog(transactionID: number, pageID: string, value: string)
        +read(pageID: string)
        +commit(transactionID: number)
        +flush(pageID: string)
        +setCheckpoint()
        +addOperation(operation: Operation, operations: Operations)
        +clone(obj: any)
        +toggleOperationActive(orderID: number)
    }
    <<interface>> DiskPage
        +page: string
        +pageLSN: number | null
        +value: string

    interface Disk {
        +pages: DiskPage[] | never
    }
    interface LogEntry {
        +LSN: number
        +prevLSN: number | null
        +transactionID: number
        +type: 'Update' | 'Commit' | 'End' | 'CLR' | 'Checkpoint'
        +pageID: string
        +persisted?: boolean
    }
    interface Log {
        +entries: LogEntry[] | never
    }
    interface BufferPage {
        +pageID: string
        +value: string
        +pageLSN: number | null
    }
    interface Buffer {
        +pages: BufferPage[] | never
    }
    interface TransactionTableItem {
        +transactionID: number
        +status: string
        +lastLSN: number | null
    }
    interface TransactionTable {
        +items: TransactionTableItem[] | never
    }
    interface DirtyPageTableItem {
        +pageID: string
        +recLSN: number | null
    }
    interface DirtyPageTable {
        +items: DirtyPageTableItem[] | never
    }
    interface Checkpoint {
        +transactionTable: TransactionTable | null
        +dirtyPageTable: DirtyPageTable | null
        +nextLSN: number | null
    }
    interface WriteOperation {
        +type: string
        +transactionID: number
        +pageID: string
        +value: string
    }
    interface FlushOperation {
        +type: string
        +pageID: string
    }
    interface CommitOperation {
        +type: string
        +transactionID: number
    }
    interface CheckpointOperation {
        +type: string
    }
    interface Operation {
        +active?: boolean
        +orderID: number | never
        +operation: WriteOperation | FlushOperation | CommitOperation | CheckpointOperation
    }
    interface Operations {
        +items: Operation[] | never
    }
```
