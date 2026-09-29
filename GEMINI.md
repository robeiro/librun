# Diretrizes de Segurança e Privacidade de Dados

Este arquivo define regras de segurança estritas e inegociáveis para o assistente em todos os projetos deste workspace.

---

## 1. PROIBIÇÃO ABSOLUTA DE ACESSO A BANCOS DE PRODUÇÃO / INSTITUCIONAIS

O assistente está terminantemente proibido de:
1. **Conectar-se ou executar consultas** direta ou indiretamente contra qualquer banco de dados de produção, homologação remota ou banco institucional.
2. **Executar comandos ou scripts** (`python`, `psql`, `mysql`, `sqlite3`, `curl`, etc.) que façam conexões a:
   - IPs institucionais (ex.: `200.137.217.*`, `200.137.218.*`, `200.137.221.*` ou qualquer IP público institucional).
   - Hosts institucionais ou remotos (ex.: `*.cercomp.ufg.br`, `*.ufg.br`, `bds-homolog.*`, `bd-pg-inst.*`).
   - Bases institucionais (ex.: `sigaa`, `sipac`, `sagui_desenv`, `sei_treina`, etc.).
3. **Imprimir registros de banco no terminal (`stdout`)**: Qualquer dado exibido no terminal é transmitido aos servidores da IA. Portanto, nunca execute queries que despejem linhas de tabelas reais.

---

## 2. PROIBIÇÃO DE LEITURA DE ARQUIVOS DE CREDENCIAIS DE PRODUÇÃO

O assistente nunca deve ler, exibir ou incluir no contexto:
- Arquivos de configuração de produção, como `application-prod.properties`, `application-homolog.properties`, `.env.production`.
- Arquivos de dump ou exportações de dados reais (`*.dump`, `*.sql` contendo `INSERT` de dados reais, `.csv` exportados de produção).

---

## 3. PADRÃO PARA DESENVOLVIMENTO E TESTES

Quando for necessário testar código ou trabalhar com banco de dados:
1. **Ambientes 100% Locais:** Utilizar apenas SQLite local (`dev.db`, `librun.db`) ou containers Docker locais rodando na própria máquina (ex.: `localhost:5432`, `localhost:15432`).
2. **Dados Mock / Sintéticos:** Utilizar dados fictícios gerados por seeders, mocks ou factories. Nunca importar dados reais de usuários ou servidores para o ambiente do assistente.
3. **Inspeção de Schema:** Caso precise entender tabelas ou estruturas, consulte os arquivos de código (modelos ORM, migrations, DDL) ou utilize consultas com `LIMIT 0` em bancos de desenvolvimento locais, sem exibir registros de dados.
