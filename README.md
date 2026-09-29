# 🏃‍♂️ librun — Inteligência & Estatísticas de Rendimento para Corrida (Strava)

O **librun** é uma aplicação completa de análise de desempenho e fisiologia do exercício para corredores. Ele lê suas atividades sincronizadas diretamente do **Strava** (via API oficial ou upload de exportação) e diagnostica com precisão **onde você está perdendo rendimento, como correr mais rápido e como prevenir lesões ortopédicas**.

---

## 🎯 O Que o librun Faz por Você ("Onde Você Precisa Melhorar")

Diferente de dashboards genéricos, o **librun** atua como um treinador científico (Coach IA) baseado em evidências esportivas:

1. **Diagnóstico da "Armadilha da Zona Cinzenta" (Regra 80/20 / Polarização)**:
   - Identifica se você está correndo forte demais nos dias fáceis (Zona 3). 
   - A Zona 3 gera cansaço muscular crônico sem estimular o desenvolvimento mitocondrial/queima de gordura da Zona 2 e sem atingir o limiar da Zona 4.
2. **Índice ACWR (Acute:Chronic Workload Ratio — Prevenção de Lesões)**:
   - Compara a carga aguda dos últimos 7 dias com a média crônica dos últimos 28 dias.
   - Detecta imediatamente se você está no *Sweet Spot* seguro (0.8 a 1.3) ou na *Zona de Perigo* (> 1.4), momento em que ocorrem 80% das canelites, tendinopatias e fascite plantar.
3. **Eficiência de Passada & Cadência (spm)**:
   - Avalia se sua cadência média (< 162 spm) indica *overstriding* (passada excessivamente longa com contato à frente do centro de gravidade, multiplicando a carga no joelho).
4. **Regra dos 10% & Longão Desproporcional**:
   - Analisa o crescimento de volume semanal e avisa se o seu treino longo de fim de semana está concentrando mais de 35-40% do volume da semana inteira.
5. **Predição de Tempos de Prova (Fórmula Calibrada de Pete Riegel)**:
   - Estima seu potencial e ritmo sugerido (min/km) para **5 km**, **10 km**, **Meia Maratona (21.1 km)** e **Maratona (42.2 km)** a partir de seus melhores esforços recentes.
6. **Librun Performance Index (0 a 100)**:
   - Score equilibrado composto por: Consistência (25%), Carga ACWR (25%), Polarização 80/20 (25%) e Cadência (25%).

---

## 🚀 Como Rodar o App Localmente

### Pré-requisitos
- Python 3.10+
- Node.js 18+

### 1. Iniciar o Backend (FastAPI)
```bash
cd backend
python3 -m uvicorn main:app --reload --port 8000
```
O backend ficará disponível em `http://localhost:8000` (documentação Swagger interativa em `http://localhost:8000/docs`).

### 2. Iniciar o Frontend (Next.js)
Em outro terminal:
```bash
cd frontend
npm run dev
```
Abra o navegador em **`http://localhost:3000`**.

> **Dica:** Você também pode rodar `./start.sh` na raiz para iniciar ambos os serviços simultaneamente!

---

## ⚡ Como Carregar Suas Atividades do Strava

O **librun** oferece 3 formas simples e flexíveis:

### 1. Conexão Direta com a API do Strava (OAuth)
1. Acesse [Strava Developers](https://www.strava.com/settings/api).
2. Crie uma aplicação gratuita.
3. No campo **Authorization Callback Domain**, defina `localhost`.
4. No **librun**, clique em **"Sincronizar Strava"**, informe o seu **Client ID** e **Client Secret** e clique em **"Autorizar com o Strava"**.
5. Suas corridas serão sincronizadas e atualizadas automaticamente.

### 2. Importação Direta de Arquivo (Sem precisar de chaves de API)
1. No site do Strava, vá em: `Configurações > Minha Conta > Baixar ou Excluir sua Conta > Solicitar seu Arquivo`.
2. Você receberá por e-mail um arquivo compactado do Strava.
3. No **librun**, abra o modal de sincronização, vá na aba **"Importar Arquivo"** e arraste o seu `export.zip` ou o arquivo `activities.csv` contido nele.
4. Suporta também arquivos `.gpx` individuais de treinos!

### 3. Teste Instantâneo com Dados de Exemplo
Se quiser ver todas as análises, gráficos e diagnósticos em ação antes de conectar sua conta, basta clicar no botão **"Dados de Exemplo"** no topo da tela. Um histórico realista de 10 semanas de corrida com padrões típicos de corredores amadores será carregado instantaneamente.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **Backend**: FastAPI (Python), Pandas, HTTPX, SQLite (zero-config, leve e rápido).
- **Ciência de Dados**: Fórmulas de Pete Riegel (predição de provas), ACWR (Gabbett TJ), modelo de treinamento polarizado (Dr. Stephen Seiler) e zonas de frequência cardíaca.
