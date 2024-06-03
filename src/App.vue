<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCaretLeft,
  faForward,
  faFilePen,
  // faDownload,
  //faCheckDouble,
  faFlag,
  faUpload,
  faHardDrive,
  faRotateLeft,
  faScrewdriverWrench,
  faMemory,
  faCircleQuestion,
  faTriangleExclamation,
  faBan,
  faStop
} from '@fortawesome/free-solid-svg-icons'
import Logging, { type Operation } from '@/classes/logging'
import { computed, ref, onMounted, onUpdated } from 'vue'
import { toast } from 'vue3-toastify'

const status = ref('normal')
const showModal = ref(false)

//variáveis do formulário
const formWriteTransaction = ref('')
const formReadTransaction = ref('')
const formFlushPage = ref('')
const formCommitTransaction = ref('')
const formEndTransaction = ref('')
const formAbortTransaction = ref('')

//estado de botões
const writeButtonDisabled = computed(() => {
  return (
    formWriteTransaction.value === '' ||
    formWriteTransaction.value.split(' ').length < 3 ||
    formWriteTransaction.value.split(' ')[2] === '' ||
    formWriteTransaction.value.split(' ').length > 3 ||
    isNaN(parseInt(formWriteTransaction.value.split(' ')[0])) ||
    !isNaN(parseInt(formWriteTransaction.value.split(' ')[1])) ||
    formWriteTransaction.value.split(' ')[1] === '' ||
    formWriteTransaction.value.split(' ')[2] === '' ||
    // check if the value at [1] index exists in logging.buffer.pages as a pageID
    !logging.value.operations.items.some(
      (op) =>
        op.operation.type === 'Read' &&
        formWriteTransaction.value.split(' ')[1].toUpperCase() === op.operation.pageID &&
        op.operation.transactionID === parseInt(formWriteTransaction.value.split(' ')[0])
    ) ||
    // check this.operations.items if transactionID has an 'End' or 'Abort' operation
    logging.value.operations.items.some(
      (op) =>
        (op.operation.type === 'End' || op.operation.type === 'Abort') &&
        op.operation?.transactionID === parseInt(formWriteTransaction.value.split(' ')[0])
    ) ||
    abortedAndEndedTransactions.value.includes(parseInt(formWriteTransaction.value.split(' ')[0]))
  )
})

const readButtonDisabled = computed(() => {
  return (
    formReadTransaction.value === '' ||
    formReadTransaction.value.split(' ').length < 2 ||
    formReadTransaction.value.split(' ')[1] === '' ||
    formReadTransaction.value.split(' ').length > 2 ||
    isNaN(parseInt(formReadTransaction.value.split(' ')[0])) ||
    !isNaN(parseInt(formReadTransaction.value.split(' ')[1])) ||
    formReadTransaction.value.split(' ')[1] === '' ||
    !['A', 'B', 'C', 'D', 'E', 'F'].includes(
      formReadTransaction.value.split(' ')[1].toUpperCase()
    ) ||
    abortedAndEndedTransactions.value.includes(parseInt(formReadTransaction.value.split(' ')[0]))
  )
})

const endButtonDisabled = computed(() => {
  return (
    formEndTransaction.value === '' ||
    formEndTransaction.value.split(' ').length < 1 ||
    formEndTransaction.value.split(' ')[0] === '' ||
    formEndTransaction.value.split(' ').length > 1 ||
    isNaN(parseInt(formEndTransaction.value.split(' ')[0])) ||
    !logging.value.operations.items
      .filter((op) => op.operation.type === 'Write' || op.operation.type === 'Read')
      .some(
        (op) =>
          (op.operation?.type === 'Write' || op.operation?.type === 'Read') &&
          op.operation?.transactionID === parseInt(formEndTransaction.value.split(' ')[0])
      ) ||
    logging.value.operations.items.some(
      (op) =>
        (op.operation.type === 'Abort' || op.operation.type === 'End') &&
        op.operation?.transactionID === parseInt(formEndTransaction.value.split(' ')[0])
    )
  )
})

const abortButtonDisabled = computed(() => {
  return (
    formAbortTransaction.value === '' ||
    formAbortTransaction.value.split(' ').length < 1 ||
    formAbortTransaction.value.split(' ')[0] === '' ||
    formAbortTransaction.value.split(' ').length > 1 ||
    isNaN(parseInt(formAbortTransaction.value.split(' ')[0])) ||
    // create a subset of logging.value.operations.items that only have write and read operations,
    // then check if the value of [0] index exists in the subset as a transactionID
    !logging.value.operations.items
      .filter((op) => op.operation.type === 'Write' || op.operation.type === 'Read')
      .some(
        (op) =>
          (op.operation?.type === 'Write' || op.operation?.type === 'Read') &&
          op.operation?.transactionID === parseInt(formAbortTransaction.value.split(' ')[0])
      ) ||
    // check if the transaction has an end operation
    logging.value.operations.items.some(
      (op) =>
        (op.operation.type === 'End' || op.operation.type === 'Abort') &&
        op.operation?.transactionID === parseInt(formAbortTransaction.value.split(' ')[0])
    )
  )
})

//propriedades computadas

const formatedTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Write',
      transactionID: parseInt(formWriteTransaction.value.split(' ')[0]),
      pageID: formWriteTransaction.value.split(' ')[1].toUpperCase(),
      value: formWriteTransaction.value.split(' ')[2]
    }
  }
})

const formatedEndTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'End',
      transactionID: parseInt(formEndTransaction.value.split(' ')[0])
    }
  }
})

const formatedAbortTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Abort',
      transactionID: parseInt(formAbortTransaction.value.split(' ')[0])
    }
  }
})

const formatedReadTransaction = computed((): Operation => {
  return {
    orderID: logging.value.operations.items.length + 1,
    operation: {
      type: 'Read',
      transactionID: parseInt(formReadTransaction.value.split(' ')[0]),
      pageID: formReadTransaction.value.split(' ')[1].toUpperCase()
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

const abortedAndEndedTransactions = computed((): number[] => {
  let aet = []
  aet = logging.value.operations.items.map((op): number => {
    if (op.operation.type === 'End' || op.operation.type === 'Abort') {
      return op.operation.transactionID
    } else {
      return 0
    }
  })
  aet = aet.filter((i) => i !== 0)
  return aet || []
})

//instancia do objeto Aries e funções
const logging = ref(new Logging())

function addOperation(operation: Operation) {
  formWriteTransaction.value = ''
  formReadTransaction.value = ''
  formFlushPage.value = ''
  formCommitTransaction.value = ''
  formEndTransaction.value = ''
  formAbortTransaction.value = ''

  logging.value.addOperation(operation)
}

const executeOperation = () => {
  const opn = logging.value.getCurrentOperation()
  if (opn) {
    logging.value.newLogEntry(opn)
  }
}

const resetState = () => {
  status.value = 'normal'
  logging.value = new Logging()
  logging.value.operations.items = []
  logging.value.currentOperationIdx = 0
}

const startRecover = () => {
  status.value = 'Recover'
  toast.warn('Recuperação de Falhas: RM_RESTART()')
  logging.value.restart()
}

onMounted(() => {
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight') {
      if (logging.value.currentOperationIdx < logging.value.operations.items.length) {
        executeOperation()
      }
    }
  })
  console.log(abortedAndEndedTransactions.value)
})

onUpdated(() => {
  if (status.value === 'crash') {
    toast.error('Crash')
    status.value = 'preRecovery'
  }
  if (logging.value.message.enabled && logging.value.message.type === 'Info') {
    toast.info(logging.value.message.text)
    logging.value.log.entries.forEach((e) => (e.persisted = true))
    logging.value.message.enabled = false
  }
})
</script>

<template>
  <div id="container" class="flex flex-row h-fit pt-3">
    <div id="Operations" class="w-1/5 bg-slate-800 h-full">
      <div class="bg-slate-800 h-full p-1">
        <div class="bg-gray-700 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50 flex items-center space-x-2">
            Operações&nbsp;
            <button
              class="rounded-full bg-blue-500 w-9 h-9 flex items-center justify-center"
              @click="showModal = true"
            >
              <FontAwesomeIcon :icon="faCircleQuestion" class="text-s" />
            </button>
          </h2>
          <div class="flex items-center space-x-2 py-5">
            <button
              class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2"
              @click="resetState()"
            >
              <FontAwesomeIcon :icon="faRotateLeft" />
            </button>
            <button
              class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2"
              @click="
                () => {
                  logging.simulateCrash()
                  status = 'crash'
                }
              "
            >
              <FontAwesomeIcon :icon="faTriangleExclamation" />
            </button>
            <button
              v-show="status === 'normal'"
              class="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
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
            <button
              v-show="status === 'preRecovery' || status === 'crash'"
              class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2"
              @click="startRecover()"
            >
              <FontAwesomeIcon :icon="faScrewdriverWrench" />
            </button>
          </div>
          <div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                id="read"
                v-model="formReadTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2 w-full"
                placeholder="READ T D"
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
                id="write"
                v-model="formWriteTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2 w-full"
                placeholder="WRITE T D V"
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
                id="end"
                v-model="formEndTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2 w-full"
                placeholder="END T"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-5 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': endButtonDisabled }"
                :disabled="endButtonDisabled"
                @click="addOperation(formatedEndTransaction)"
              >
                <FontAwesomeIcon :icon="faStop" />
              </button>
            </div>
            <div class="flex items-center space-x-2 pb-2">
              <input
                id="abort"
                v-model="formAbortTransaction"
                type="text"
                class="border border-gray-300 rounded-lg px-4 py-2 w-full"
                placeholder="ABORT T"
              />
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white ml-2 rounded-lg px-4 py-2"
                :class="{ 'opacity-50 cursor-not-allowed': abortButtonDisabled }"
                :disabled="abortButtonDisabled"
                @click="addOperation(formatedAbortTransaction)"
              >
                <FontAwesomeIcon :icon="faBan" />
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
                class="flex items-center space-x-2 border rounded border-slate-600 mb-1 p-2"
                v-for="(item, index) in logging.operations.items"
                v-show="!item.hidden"
                :key="item.orderID"
              >
                <div
                  :class="logging.currentOperationIdx > index ? 'text-slate-500' : 'text-slate-200'"
                >
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
        </div>
      </div>
    </div>

    <div id="Coluna1" class="w-1/2 bg-slate-800 h-full">
      <div class="flex flex-row">
        <div class="flex-1">
          <div id="disk" class="p-1">
            <div class="bg-gray-600 rounded-lg shadow-lg p-3">
              <h2 class="text-xl font-bold mb-1 text-slate-50">
                <FontAwesomeIcon :icon="faHardDrive" class="pr-2" />Disco
              </h2>
              <table class="w-full rounded">
                <thead>
                  <tr>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">X</th>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">Valor</th>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">LSN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="page in logging.disk.pages"
                    :key="page.pageID"
                    :class="page.pageLSN ? 'bg-yellow-100' : 'bg-slate-50'"
                  >
                    <td class="p-1 text_slate_800">{{ page.pageID }}</td>
                    <td class="p-1 text_slate_800">{{ page.value }}</td>
                    <td class="p-1 text_slate_800">{{ page.pageLSN }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="flex-1">
          <div id="Buffer" class="p-1 h-full">
            <div class="bg-gray-600 rounded-lg shadow-lg p-3 h-full">
              <h2 class="text-xl font-bold mb-1 text-slate-50">
                <FontAwesomeIcon :icon="faMemory" class="pr-2 animate-pulse" />Buffer
              </h2>
              <table class="w-full">
                <thead>
                  <tr>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">X</th>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">Valor</th>
                    <th class="text-left bg-slate-800 p-2 text-slate-50">LSN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="page in logging.buffer.pages" :key="page.pageID">
                    <td class="p-1 bg-slate-50 text_slate_800">{{ page.pageID }}</td>
                    <td class="p-1 bg-slate-50 text_slate_800">{{ page.value }}</td>
                    <td class="p-1 bg-slate-50 text_slate_800">{{ page.pageLSN }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div id="TransacoesAtivas" class="p-2">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">
            <FontAwesomeIcon :icon="faHardDrive" class="pr-2" />Transações
          </h2>
          <div class="flex flex-row">
            <div class="flex-1 p-1">
              <table class="w-full">
                <thead>
                  <tr>
                    <th colspan="3" class="bg-yellow-300 text-slate-800">ATIVAS</th>
                  </tr>
                  <tr>
                    <th class="text-left bg-yellow-800 p-2 text-slate-50">T</th>
                    <th class="text-left bg-yellow-800 p-2 text-slate-50">Status</th>
                    <th class="text-left bg-yellow-800 p-2 text-slate-50">LSN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="transaction in logging.transactionTable.items.filter(
                      (i) => i.status === 'Ativa'
                    )"
                    :key="transaction.transactionID"
                    class="bg-slate-50"
                  >
                    <td class="p-1 bg-yellow-100 text_slate_800">
                      {{ transaction.transactionID }}
                    </td>
                    <td class="p-1 bg-yellow-100 text_slate_800">{{ transaction.status }}</td>
                    <td class="p-1 bg-yellow-100 text_slate_800">
                      {{ transaction.lastLSN }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex-1 p-1">
              <table class="w-full">
                <thead>
                  <tr>
                    <th colspan="3" class="bg-green-300 text-slate-800">CONSOLIDADAS</th>
                  </tr>
                  <tr>
                    <th class="text-left bg-green-800 p-2 text-slate-50">T</th>
                    <th class="text-left bg-green-800 p-2 text-slate-50">Status</th>
                    <th class="text-left bg-green-800 p-2 text-slate-50">LSN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="transaction in logging.transactionTable.items.filter(
                      (i) => i.status === 'Consolidada'
                    )"
                    :key="transaction.transactionID"
                    class="bg-slate-50"
                  >
                    <td class="p-1 bg-green-200 text_slate_800">{{ transaction.transactionID }}</td>
                    <td class="p-1 bg-green-200 text_slate_800">{{ transaction.status }}</td>
                    <td class="p-1 bg-green-200 text_slate_800">
                      {{ transaction.lastLSN }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex-1 p-1">
              <table class="w-full">
                <thead>
                  <tr>
                    <th colspan="3" class="bg-red-300">ABORTADAS</th>
                  </tr>
                  <tr>
                    <th class="text-left bg-red-800 p-2 text-slate-50">T</th>
                    <th class="text-left bg-red-800 p-2 text-slate-50">Status</th>
                    <th class="text-left bg-red-800 p-2 text-slate-50">LSN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="transaction in logging.transactionTable.items.filter(
                      (i) => i.status === 'Abortada'
                    )"
                    :key="transaction.transactionID"
                    class="bg-slate-50"
                  >
                    <td class="p-1 bg-red-100 text_slate_800">{{ transaction.transactionID }}</td>
                    <td class="p-1 bg-red-100 text_slate_800">{{ transaction.status }}</td>
                    <td class="p-1 bg-red-100 text_slate_800">
                      {{ transaction.lastLSN }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div id="DirtyTable" class="p-2" v-if="false">
        <div class="bg-gray-600 rounded-lg shadow-lg p-2">
          <h2 class="text-xl font-bold mb-1 text-slate-50">
            <FontAwesomeIcon :icon="faMemory" class="pr-2" />Dados Sujos
          </h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">X</th>
                <th class="text-left bg-slate-800 p-2 text-slate-50">LSN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in logging.dirtyPageTable.items" :key="page.pageID">
                <td class="p-1 bg-slate-50 text_slate_800">{{ page.pageID }}</td>
                <td class="p-1 bg-slate-50 text_slate_800">{{ page.recLSN }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="Coluna2" class="w-1/5 bg-slate-800 h-full grow">
      <div id="Log" class="bg-gray-800 h-full p-1">
        <div class="bg-gray-700 rounded-lg shadow-lg p-1">
          <h2 class="text-xl font-bold mb-1 text-slate-50">Log</h2>
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-left bg-slate-800 p-2 text-slate-50">
                  <FontAwesomeIcon :icon="faHardDrive" />
                </th>
                <th class="text-left bg-slate-800 pl-2 text-slate-50">LSN</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">LSNAn</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">T</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">Tipo</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">X</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">AFIM</th>
                <th class="text-left bg-slate-800 pl-1 text-slate-50">BFIM</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in logging.log.entries"
                :key="entry.LSN"
                :class="entry.active ? 'bg-green-200' : 'bg-slate-50'"
              >
                <td class="p-1">
                  <FontAwesomeIcon
                    :icon="faHardDrive"
                    class="text-green-600"
                    v-if="entry.persisted"
                  />
                  <FontAwesomeIcon :icon="faMemory" class="animate-pulse text-red-600" v-else />
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.LSN }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.prevLSN }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.transactionID }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.type }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.pageID }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.value }}
                </td>
                <td class="p-1 text_slate_800">
                  {{ entry.prevValue }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="text-slate-50" v-show="false">
            <!-- <ul>
              <li v-for="i in logging.operations.items" :key="i.orderID">
                {{ i.orderID }} - {{ i.operation.type }} (T_{{ i.operation?.transactionID }})
              </li>
            </ul> -->
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-if="showModal" class="fixed inset-0 flex items-center justify-center z-50">
    <div class="absolute inset-0 bg-black opacity-50"></div>
    <div class="bg-gray-700 rounded-lg shadow-lg p-6 relative z-10">
      <h2 class="text-xl font-bold mb-4 text-slate-50">Ajuda</h2>
      <div class="text-slate-50 mb-4">
        <p class="pb-2">
          Este é um simulador de um sistema de Mecanismo de Recuperação de Falhas com Atualização
          Imediata.
        </p>
        <hr class="my-4" />
        <p class="pb-2">
          Para adicionar uma operação, preencha um dos campos de texto e clique no botão
          correspondente.
        </p>
        <table class="w-full bg-slate-900">
          <thead>
            <tr>
              <th class="text-left bg-slate-800 p-2 text-slate-50">Operaçãot</th>
              <th class="text-left bg-slate-800 p-2 text-slate-50">Descrição</th>
              <th class="text-left bg-slate-800 p-2 text-slate-50"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-1 bg-slate-600">
                <span class="text-yellow-500 font-black">READ</span>
              </td>
              <td class="p-1 bg-slate-600">
                Lê um valor de um dado. Utilize a notação
                <span class="text-yellow-500 font-black">T</span>: Transação - Numero,
                <span class="text-yellow-500 font-black">D</span>: Dado - String.
              </td>
              <td class="p-1 bg-slate-600">
                <button>
                  <FontAwesomeIcon :icon="faUpload" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="p-1 bg-slate-600">
                <span class="text-yellow-500 font-black">WRITE</span>
              </td>
              <td class="p-1 bg-slate-600">
                Escreve um valor em uma dado. Utilize a notação
                <span class="text-yellow-500 font-black">T</span>: Transação - Numero,
                <span class="text-yellow-500 font-black">D</span>: Dado - String,
                <span class="text-yellow-500 font-black">V</span>: Valor - String.
              </td>
              <td class="p-1 bg-slate-600">
                <button>
                  <FontAwesomeIcon :icon="faFilePen" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="p-1 bg-slate-600">
                <span class="text-yellow-500 font-black">END</span>
              </td>
              <td class="p-1 bg-slate-600">
                Finaliza uma transação. Utilize a notação
                <span class="text-yellow-500 font-black">T</span>: Transação - Numero.
              </td>
              <td class="p-1 bg-slate-600">
                <button>
                  <FontAwesomeIcon :icon="faStop" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="p-1 bg-slate-600">
                <span class="text-yellow-500 font-black">ABORT</span>
              </td>
              <td class="p-1 bg-slate-600">
                Aborta uma transação. Utilize a notação
                <span class="text-yellow-500 font-black">T</span>: Transação - Numero.
              </td>
              <td class="p-1 bg-slate-600">
                <button>
                  <FontAwesomeIcon :icon="faBan" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="p-1 bg-slate-600">
                <span class="text-yellow-500 font-black">CHECKPOINT</span>
              </td>
              <td class="p-1 bg-slate-600">Insere uma entrada de Checkpoint no log</td>
              <td class="p-1 bg-slate-600">
                <button>
                  <FontAwesomeIcon :icon="faFlag" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <hr class="my-4" />
        <p class="pb-2">
          Para simular a execução das operações, pressione a
          <span class="text-yellow-500 font-black">Seta para a Direita do teclado</span> ou o botão
          <span class="text-yellow-500 font-black">
            <FontAwesomeIcon :icon="faForward" />
          </span>
        </p>
        <p class="pb-2">
          Para simular uma falha, clique no botão
          <span class="text-yellow-500 font-black">
            <FontAwesomeIcon :icon="faTriangleExclamation" />
          </span>
        </p>
        <p class="pb-2">
          Para realizar a recuperação, clique no botão
          <span class="text-yellow-500 font-black">
            <FontAwesomeIcon :icon="faScrewdriverWrench" />
          </span>
        </p>
        <p class="pb-2">
          Para reiniciar a simlução, clique no botão
          <span class="text-yellow-500 font-black">
            <FontAwesomeIcon :icon="faRotateLeft" />
          </span>
        </p>
      </div>
      <div class="flex justify-end space-x-2">
        <button
          @click="showModal = false"
          class="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
