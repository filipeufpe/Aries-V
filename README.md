# Mecanismo de Recuperação de Falhas com Atualização Imediata

## Undo/No-Redo

### Descrição das Operações

<details>
<summary>
Write [RM_Write]
</summary>

1. Adiciona a transação na lista de Transações **ATIVAS**
2. Se o **DADO** não estiver na **MEMÓRIA**, leia o dado.
3. Adicione uma entrada no log, contendo a transação, o rótulo do dado, o valor a ser escrito e o valor anterior.
4. Atualize a Partição (**DISCO**) de X com o novo valor.
5. Informe o final do processamento ao escalonador.\*
</details>

<details>
<summary>
Read [RM_Read]
</summary>

1. Se o Dado X não tiver na _cache_ (também chamado de _Buffer_ que é um espaço de memória), lê o dado do Disco (**partição**).
2. Retorne o valor lido ao escalonador\*.
</details>

<details>
<summary>
Commit [RM_Commit]
</summary>

1.  Para cada item de dado **x** atualizado pela **transação**, se **x** está no _cache_ (memória), salva o log e o valor de **x** no disco.
2.  Adiciona uma entrada no log do tipo Commit para essa **transação**.
3.  Adiciona a **transação** à lista de transações consolidadas.
4.  Informa o _commit_ da **transação** ao escalonador\*.
5.  Remova a **transação** da lista de transações ativas.
</details>

<details>
<summary>Abort</summary>

1. Para cada item de dado **x** atualizado pela **transação**:  
   a) Se x não estiver na cache, leia x.  
   b) Atualize a partição de x com o valor ImAn.
2. Adicione Ti à lista de transações abortadas.
3. Informe que T i abortou ao escalonador
4. Remova Ti da lista de transações ativas.
</details>

<details>
<summary>
Restart [RM_Restart]
</summary>

1. Todo dado em memória é considerado limpo.
2. Faça desfeito = { }
3. Comece com a última entrada do Log e percorra o arquivo no sentido inverso (em direção ao início). Repita os passos abaixo até que:

- (i) desfeito = BD ou
- (ii) não existam mais entradas no Log para examinar.
  Para cada [ T , X , BFIM, AFIM ], faça:
- Se Ti não estiver na lista de transações efetivadas e x não estiver em desfeito:
- Selecione uma partição da cache para X
- Atualize a partição de X com o valor BFIM.
- desfeito = desfeito U { X }

4. Para cada Ti da lista de transações efetivadas:

- Se Ti estiver na lista de transações ativas, remova Ti desta lista

5. Informe o final do processamento de restauração ao escalonador.
</details>

### Checkpoint

- Escreve o Log no disco
- **Escrita de partições do buffer do BD, que foram modificadas, no disco**
- Inserção de um registro do tipo Checkpoint no Log do disco.

### Gerenciador de Recuperação

#### Operações Atômicas

- RM_Read
- RM_Write
- RM_Commit
- RM_Abort
- RM_Restart (Operação de recuperação)

#### Listas em Disco

- Ativas, iniciadas e não efetivadas
- Consolidadas desde o último checkpoint
- Abortadas desde o último checkpoint

#### Regras

- Atualizações são gravadas no **LOG do Disco** antes de serem aplicadas no BD
- Garantir que **BFIM** seja gravado no **LOG do DISCO** **ANTES** que **AFIM** seja grava do Banco de Dados (Disco)

#### Regra UNDO

- **BFIM** do **Banco de Dados** (Disco) não pode ser apagada pela sua **AFIM** no disco, até que todas as entradas do tipo UNDO daquela transação (até aquele ponto) tenham sido gravadas no disco.
- Garante que o **último** valor consolidado de cada item de dado é salvo em **disco** antes de ser sobrescrito por um valor não efetivado (Consolidado).

#### Protocolo

- Aplicar a operação UNDO para todas as operações write_item das transações ativas, na ordem inversa de suas gravações no Log.
  - Procedimento UNDO
    - Desfazer uma operação write_item consiste em examinar sua entrada no log: {type: 'write_item', pageID: 'X', value: AFIM} e atualizar o valor do item X no Banco de Dados (Disco) com o valor_ant (BFIM).

#### Algoritmo Undo/No-Redo

- Commit:
  1. Para cada item de dado X atualizado por Ti, se X estiver em cache, salve Log e X no disco
  2. Adicione [ Ti , commit ] ao Log do disco e Ti à lista de transações efetivadas
  3. Informe o commit de Ti ao escalonador
  4. Remova Ti da lista de transações ativas.
- Restart:
  1. Considere limpas as partições da cache
  2. Faça desfeito = { }
  3. Comece com a última entrada do Log e percorra o arquivo no sentido inverso (em direção ao início). Repita os passos abaixo até que:
  - (i) desfeito = BD ou
  - (ii) não existam mais entradas no Log para examinar.
    Para cada [ T , X , BFIM, AFIM ], faça:
  - Se Ti não estiver na lista de transações efetivadas e x não estiver em desfeito:
    - Selecione uma partição da cache para X
    - Atualize a partição de X com o valor BFIM.
    - desfeito = desfeito U { X }
  4. Para cada Ti da lista de transações efetivadas:
  - Se Ti estiver na lista de transações ativas, remova Ti desta lista
  5. Informe o final do processamento de restauração ao escalonador.
