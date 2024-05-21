<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faBackward,
  faForward,
  faFilePen,
  faDownload,
  faCheckDouble,
  faFlag,
  faUpload
} from '@fortawesome/free-solid-svg-icons'
import Logging from '@/classes/logging'
import { computed, onMounted, ref } from 'vue'

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
const formatedTransaction = computed(() => {
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

const formatedFlushPage = computed(() => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Flush',
      pageID: formFlushPage.value
    }
  }
})

const formatedReadTransaction = computed(() => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Read',
      transactionID: parseInt(formReadTransaction.value.split(' ')[0]),
      pageID: formReadTransaction.value.split(' ')[1]
    }
  }
})

const formatedCommitTransaction = computed(() => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Commit',
      transactionID: parseInt(formCommitTransaction.value.split(' ')[0])
    }
  }
})

const formatedCheckpoint = computed(() => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Checkpoint'
    }
  }
})

//instancia do objeto Aries e funções
const logging = ref(new Logging())
const addOperation = logging.value.addOperation
let operationIndex = 1
const executeOperation = () => {
  if (operationIndex <= logging.value.operations.items.length) {
    switch (logging.value.operations.items[operationIndex - 1].operation.type) {
      case 'Write':
        logging.value.write(
          //logging.value.operations.items[operationIndex - 1].operation.transactionID,
          logging.value.operations.items[operationIndex - 1].operation.pageID,
          logging.value.operations.items[operationIndex - 1].operation.value
        )
        break
      case 'Read':
        logging.value.read(
          logging.value.operations.items[operationIndex - 1].operation.pageID
        )
        break
      case 'Flush':
        logging.value.flush(logging.value.operations.items[operationIndex - 1].operation.pageID)
        break
      case 'Commit':
        logging.value.commit(
          logging.value.operations.items[operationIndex - 1].operation.transactionID
        )
        break
      case 'Checkpoint':
        //logging.value.checkpoint()
        break
    }
    operationIndex++
  }
}
</script>

<template>
  <div id="container" class="flex flex-row">
    <div id="Operations" class="basis-1/5 bg-slate-800h-screen">
      <div class="bg-slate-800 h-screen p-2">
        <div class="bg-gray-700 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Operações</h2>

          <div class="flex items-center space-x-2 pb-3">
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
              @click="addOperation(formatedTransaction, logging.operations)"
            >
              <FontAwesomeIcon :icon="faFilePen" />
            </button>
          </div>
          <div class="flex items-center space-x-2 pb-3">
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
              @click="addOperation(formatedReadTransaction, logging.operations)"
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
              @click="addOperation(formatedFlushPage, logging.operations)"
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
              @click="addOperation(formatedCommitTransaction, logging.operations)"
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
              @click="addOperation(formatedCheckpoint, logging.operations)"
            >
              <FontAwesomeIcon :icon="faFlag" />
            </button>
          </div>
          <ul class="mb-1 text-slate-200">
            <!-- List of elements -->
            <li
              class="flex items-center space-x-2"
              v-for="operation in logging.operations.items"
              :key="operation.orderID"
            >
              <span>
                <span v-if="'transactionID' in operation.operation"
                  >T_{{ operation.operation.transactionID }}</span
                >
                {{ operation.operation.type }}
                (<span v-if="'pageID' in operation.operation">{{
                  operation.operation.pageID
                }}</span>
                <span v-if="'value' in operation.operation">,{{ operation.operation.value }}</span
                >)
              </span>
            </li>
          </ul>
          <div class="flex items-center space-x-2 py-5">
            <button class="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2">
              <FontAwesomeIcon :icon="faBackward" />
            </button>
            <button
              class="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
              :class="{
                'opacity-50 cursor-not-allowed':
                  logging.operations.items.length === 0 ||
                  operationIndex > logging.operations.items.length
              }"
              :disabled="
                logging.operations.items.length === 0 ||
                operationIndex > logging.operations.items.length
              "
              @click="executeOperation()"
            >
              <FontAwesomeIcon :icon="faForward" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="Coluna1" class="basis-2/5 bg-slate-700 h-screen">
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
              >
                <td class="p-2 bg-slate-50 text_slate_800">{{ transaction.transactionID }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ transaction.status }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ transaction.lastLSN }}</td>
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
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageLSNw</th>
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
              <tr v-for="page in logging.disk.pages" :key="page.page">
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.page }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.value }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ page.pageLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="Coluna2" class="basis-2/5 bg-slate-800h-screen">
      <div id="Log" class="bg-gray-700 h-screen p-2">
        <div class="bg-gray-700 rounded-lg shadow-lg p-2 overflow-y-auto">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Logs</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">LSN</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">prevLSN</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">transactionID</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">type</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">pageID</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in logging.log.entries" :key="entry.LSN">
                <td class="p-2 bg-slate-50 text_slate_800">{{ entry.LSN }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ entry.prevLSN }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ entry.transactionID }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ entry.type }}</td>
                <td class="p-2 bg-slate-50 text_slate_800">{{ entry.pageID }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
