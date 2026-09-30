# 🏃‍♂️ librun — Inteligência & Estatísticas de Rendimento para Corrida (Strava)

O **librun** é uma aplicação completa de análise de desempenho, fisiologia do exercício e inteligência artificial para corredores. Ele lê suas atividades sincronizadas diretamente do **Strava** (via API oficial ou upload de exportação) e diagnostica com precisão **onde você está perdendo rendimento, como correr mais rápido e como prevenir lesões ortopédicas**.

---

## 📱 App para Celular (Android & iOS)

O **librun** possui suporte nativo a **PWA (Progressive Web App)**, permitindo que qualquer usuário o instale diretamente no smartphone como um aplicativo nativo:

1. Acesse o **librun** pelo navegador do seu celular (ex: Google Chrome no Android ou Safari no iPhone).
2. O sistema exibirá automaticamente um aviso na base da tela: **"Instalar librun no Celular"**.
3. Toque em **Instalar** (ou no menu do navegador ⋮ > *"Adicionar à tela inicial"*).
4. O ícone do **librun** será criado na gaveta de aplicativos do seu celular e abrirá em **tela cheia**, sem barra de navegação, com abertura instantânea.

---

## 🚀 Como Rodar na Sua Máquina

O librun pode ser executado facilmente de diferentes maneiras, tanto para quem prefere rodar com 1 clique quanto para desenvolvedores:

### Opção 1: Com Docker (Recomendado para Leigos — 1 Comando)
Se você tem o **Docker Desktop** instalado:
```bash
docker compose up -d
```
Abra o navegador em: **`http://localhost:3000`**. Tudo subirá isolado e configurado automaticamente!

---

### Opção 2: No Windows (Sem Docker)
1. Dê um **duplo clique** no arquivo **`start.bat`** na pasta do projeto.
2. O script iniciará o backend e o frontend automaticamente e abrirá a aplicação no seu navegador.

---

### Opção 3: No Linux ou macOS
Abra o terminal na pasta do projeto e execute:
```bash
./start.sh
```
Para encerrar a execução a qualquer momento:
```bash
./stop.sh
```

---

### Opção 4: Manualmente (Modo Desenvolvedor)
#### 1. Iniciar o Backend (FastAPI):
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```
API disponível em `http://localhost:8000` (documentação Swagger interativa em `http://localhost:8000/docs`).

#### 2. Iniciar o Frontend (Next.js):
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
Acesse: **`http://localhost:3000`**.

---

## 🎯 O Que o librun Faz por Você ("Onde Você Precisa Melhorar")

Diferente de dashboards genéricos, o **librun** atua como um treinador científico baseado em evidências esportivas:

1. **🤖 Treinador IA Integrado (Google Gemini API)**:
   - Diagnóstico fisiológico aprofundado gerado por inteligência artificial.
   - Analisa seu histórico completo de volume, cadência e zonas cardíacas.
   - Prescreve um **plano tático de treinos para as próximas 2 semanas** adaptado à sua distância e meta de tempo.
   - Suporte a seleção de modelos mais rápidos e estáveis (`gemini-flash-lite-latest`, `gemini-3.5-flash`, `gemini-3.8-flash`, etc.).
2. **⚔️ Duelo Virtual de Corridas com Mapa GPS**:
   - Compare duas atividades passadas lado a lado em tempo real a 60 fps.
   - Visualização no **mapa real (Leaflet)** com traçado GPS, telemetria simultânea (pace, FC, elevação) e marcadores interativos de largada, chegada e posição atual dos atletas.
3. **Diagnóstico da "Armadilha da Zona Cinzenta" (Regra 80/20 / Polarização)**:
   - Identifica se você está correndo forte demais nos dias fáceis (Zona 3). 
   - A Zona 3 gera cansaço muscular crônico sem estimular o desenvolvimento mitocondrial/queima de gordura da Zona 2 e sem atingir o limiar da Zona 4.
4. **Índice ACWR (Acute:Chronic Workload Ratio — Prevenção de Lesões)**:
   - Compara a carga aguda dos últimos 7 dias com a média crônica dos últimos 28 dias.
   - Detecta imediatamente se você está no *Sweet Spot* seguro (0.8 a 1.3) ou na *Zona de Perigo* (> 1.4), momento em que ocorrem 80% das canelites, tendinopatias e fascite plantar.
5. **Eficiência de Passada & Cadência (spm)**:
   - Avalia se sua cadência média (< 162 spm) indica *overstriding* (passada excessivamente longa com contato à frente do centro de gravidade, multiplicando a carga no joelho).
6. **Regra dos 10% & Longão Desproporcional**:
   - Analisa o crescimento de volume semanal e avisa se o seu treino longo de fim de semana está concentrando mais de 35-40% do volume da semana inteira.
7. **Predição de Tempos de Prova (Fórmula Calibrada de Pete Riegel)**:
   - Estima seu potencial e ritmo sugerido (min/km) para **5 km**, **10 km**, **Meia Maratona (21.1 km)** e **Maratona (42.2 km)** a partir de seus melhores esforços recentes.
8. **Librun Performance Index (0 a 100)**:
   - Score equilibrado composto por: Consistência (25%), Carga ACWR (25%), Polarização 80/20 (25%) e Cadência (25%).
9. **📈 Gráfico de Progresso & Evolução Temporal**:
   - Curva de evolução treino a treino com linha de tendência de média móvel suavizada para eliminar ruídos.
   - Monitoramento do **Fator de Eficiência Aeróbica** (velocidade em m/min por batimento cardíaco), Frequência Cardíaca, Cadência e Volume.
   - Visualização por corrida individual, consolidação semanal e consolidação mensal, com filtros por distância (curtas, médias e longões) e cálculo automático de deltas de melhora.

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
Se quiser ver todas as análises, gráficos, duelos e diagnósticos em ação antes de conectar sua conta, basta clicar no botão **"Dados de Exemplo"** no topo da tela. Um histórico realista de 10 semanas de corrida com padrões típicos de corredores amadores será carregado instantaneamente.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Leaflet (mapas GPS), PWA (Service Workers & Web App Manifest).
- **Backend**: FastAPI (Python 3.11), Pydantic, HTTPX, SQLite local (zero-config, leve e rápido).
- **Inteligência Artificial**: Google Gemini API com suporte a múltiplos modelos (`gemini-flash-lite-latest`, `gemini-3.5-flash`, etc.).
- **Deploy & Contêineres**: Docker, Docker Compose, scripts automatizados para Windows (`start.bat`) e Linux/Mac (`start.sh`).
