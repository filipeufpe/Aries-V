<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCaretLeft,
  faForward,
  faFilePen,
  faDownload,
  faCheckDouble,
  faFlag,
  faUpload,
  faHardDrive
} from '@fortawesome/free-solid-svg-icons'
import type {
  CommitOperation,
  FlushOperation,
  Operation,
  ReadOperation,
  WriteOperation
} from '@/classes/logging'
import Logging from '@/classes/logging'
import { computed, ref, onMounted } from 'vue'

//variáveis do formulário
const formWriteTransaction = ref('')
const formReadTransaction = ref('')
const formFlushPage = ref('')
const formCommitTransaction = ref('')

//estado de botões
const writeButtonDisabled = computed(() => {
  return (
    formWriteTransaction.value === '' ||
    formWriteTransaction.value.split(' ').length < 3 ||
    formWriteTransaction.value.split(' ')[2] === '' ||
    formWriteTransaction.value.split(' ').length > 3
  )
})
const readButtonDisabled = computed(() => {
  return (
    formReadTransaction.value === '' ||
    formReadTransaction.value.split(' ').length < 2 ||
    formReadTransaction.value.split(' ')[1] === '' ||
    formReadTransaction.value.split(' ').length > 2
  )
})
const flushButtonDisabled = computed(() => {
  return (
    formFlushPage.value === '' ||
    formFlushPage.value.split(' ').length < 1 ||
    formFlushPage.value.split(' ')[0] === '' ||
    formFlushPage.value.split(' ').length > 1
  )
})
const commitButtonDisabled = computed(() => {
  return (
    formCommitTransaction.value === '' ||
    formCommitTransaction.value.split(' ').length < 1 ||
    formCommitTransaction.value.split(' ')[0] === '' ||
    formCommitTransaction.value.split(' ').length > 1
  )
})

//propriedades computadas
const formatedTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Write',
      transactionID: parseInt(formWriteTransaction.value.split(' ')[0]),
      pageID: formWriteTransaction.value.split(' ')[1],
      value: formWriteTransaction.value.split(' ')[2]
    }
  }
})

const formatedFlushPage = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Flush',
      pageID: formFlushPage.value
    }
  }
})

const formatedReadTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Read',
      transactionID: parseInt(formReadTransaction.value.split(' ')[0]),
      pageID: formReadTransaction.value.split(' ')[1]
    }
  }
})

const formatedCommitTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Commit',
      transactionID: parseInt(formCommitTransaction.value.split(' ')[0])
    }
  }
})

const formatedCheckpoint = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Checkpoint'
    }
  }
})

//instancia do objeto Aries e funções
const logging = ref(new Logging())
const addOperation = (operation: Operation) => {
  logging.value.addOperation(operation)
}

const executeOperation = () => {
  const opn = logging.value.getCurrentOperation()

  const wopn = opn as WriteOperation
  const ropn = opn as ReadOperation
  const fopn = opn as FlushOperation
  const copn = opn as CommitOperation

  switch (opn.type) {
    case 'Write':
      logging.value.write(wopn.pageID, wopn.value, wopn.transactionID)
      logging.value.writeLog(wopn.transactionID, wopn.pageID, wopn.value)
      break
    case 'Read':
      logging.value.read(ropn.pageID)
      break
    case 'Flush':
      logging.value.flush(fopn.pageID)
      break
    case 'Commit':
      logging.value.commit(copn.transactionID)
      break
    case 'Checkpoint':
      logging.value.setCheckpoint()
      break
    default:
      console.log('Operação não encontrada')
      break
  }
}

onMounted(() => {
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight') {
      if (logging.value.currentOperationIdx < logging.value.operations.items.length) {
        executeOperation()
      }
    }
  })
})
</script>

<template>
  <div id="container" class="flex flex-row h-fit" @keyup.right="executeOperation()">
    <div id="Operations" class="basis-1/5 bg-slate-800 h-full">
      <div class="bg-slate-800 h-full p-2">
        <div class="bg-gray-700 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Operações</h2>
          <div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                v-model="formWriteTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2"
                placeholder="WRITE T P V"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': writeButtonDisabled }"
                :disabled="writeButtonDisabled"
                @click="addOperation(formatedTransaction)"
              >
                <FontAwesomeIcon :icon="faFilePen" />
              </button>
            </div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                v-model="formReadTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2"
                placeholder="READ T P"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': readButtonDisabled }"
                :disabled="readButtonDisabled"
                @click="addOperation(formatedReadTransaction)"
              >
                <FontAwesomeIcon :icon="faUpload" />
              </button>
            </div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                v-model="formFlushPage"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2"
                placeholder="Flush P"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': flushButtonDisabled }"
                :disabled="flushButtonDisabled"
                @click="addOperation(formatedFlushPage)"
              >
                <FontAwesomeIcon :icon="faDownload" />
              </button>
            </div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                v-model="formCommitTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2"
                placeholder="Commit T"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': commitButtonDisabled }"
                :disabled="commitButtonDisabled"
                @click="addOperation(formatedCommitTransaction)"
              >
                <FontAwesomeIcon :icon="faCheckDouble" />
              </button>
            </div>
            <div class="flex items-center space-x-2 pr-1">
              <div class="border border-gray-300 rounded-lg px-4 py-2 bg-white w-full pr-4">
                <span>Checkpoint</span>
              </div>
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                @click="addOperation(formatedCheckpoint)"
              >
                <FontAwesomeIcon :icon="faFlag" />
              </button>
            </div>
          </div>
          <div class="py-2">
            <ul class="mb-1 text-slate-200">
              <!-- List of elements -->
              <li
                class="flex items-center space-x-2 border rounded mb-1 p-2"
                v-for="(item, index) in logging.operations.items"
                :key="item.orderID"
              >
                <div>
                  <span v-if="'transactionID' in item.operation">
                    T_{{ item.operation.transactionID }}
                  </span>
                  {{ item.operation.type }}
                  (
                  <span v-if="'pageID' in item.operation">
                    {{ item.operation.pageID }}
                  </span>
                  <span v-if="'value' in item.operation"> , {{ item.operation.value }} </span>
                  )
                  <span v-if="logging.currentOperationIdx === index">
                    <FontAwesomeIcon :icon="faCaretLeft" />
                  </span>
                </div>
              </li>
            </ul>
          </div>
          <div class="flex items-center space-x-2 py-5">
            <button
              class="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
              :class="{
                'opacity-50 cursor-not-allowed':
                  logging.operations.items.length === 0 ||
                  logging.currentOperationIdx >= logging.operations.items.length
              }"
              :disabled="
                logging.operations.items.length === 0 ||
                logging.currentOperationIdx >= logging.operations.items.length
              "
              @click="executeOperation()"
            >
              <FontAwesomeIcon :icon="faForward" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="Coluna1" class="basis-2/5 bg-slate-800 h-full">
      <div id="Transacoes" class="p-2">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Transações</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">ID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">Status</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">lastLSN</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="transaction in logging.transactionTable.items"
                :key="transaction.transactionID"
                class="bg-slate-50"
              >
                <td class="p-2 text_slate_800">{{ transaction.transactionID }}</td>
                <td class="p-2 text_slate_800">{{ transaction.status }}</td>
                <td class="p-2 text_slate_800">{{ transaction.lastLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div id="Buffer" class="p-2">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Buffer</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">value</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageLSN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in logging.buffer.pages" :key="page.pageID">
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageID }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.value }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div id="DirtyTable" class="p-2">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Dirty Page Table</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">recLSN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in logging.dirtyPageTable.items" :key="page.pageID">
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageID }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.recLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div id="disk" class="p-2">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Disco</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">value</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageLSN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in logging.disk.pages" :key="page.pageID">
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageID }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.value }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="Coluna2" class="basis-2/5 bg-slate-800 h-full">
      <div id="Log" class="bg-gray-700 h-full p-2">
        <div class="bg-gray-700 rounded-lg shadow-lg p-2 overflow-y-auto">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Logs</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">
                  <FontAwesomeIcon :icon="faHardDrive" />
                </th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">LSN</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">prevLSN</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">transactionID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">type</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in logging.log.entries" :key="entry.LSN" class="bg-slate-50">
                <td class="p-2 text_slate_800">
                  <FontAwesomeIcon :icon="faHardDrive" v-if="entry.persisted" />
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.LSN }}
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.prevLSN }}
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.transactionID }}
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.type }}
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.pageID }}
                </td>
                <td class="p-2 text_slate_800">
                  {{ entry.value }}
                </td>
              </tr>
            </tbody>
          </table>
          <div>
            <!-- <pre class="text-slate-200">{{ logging.checkpoint }}</pre> -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
