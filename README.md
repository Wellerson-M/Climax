# 🌡️ Climax - Sistema IoT de Monitoramento de Temperatura e Umidade

Projeto completo de monitoramento em tempo real de temperatura e umidade usando ESP32, MQTT, Node.js e uma interface web moderna hospedada no Netlify.

![Image](https://github.com/user-attachments/assets/568c7630-44eb-4158-be74-743e44bb8373)

## 🎯 Características

- **Monitoramento em Tempo Real**: Coleta dados a cada 30 segundos via sensor DHT22
- **Análise com IA**: Detecção de anomalias e previsão de tendências usando regressão linear
- **Dashboard Interativo**: Interface web responsiva com gráficos em tempo real
- **MQTT Protocol**: Comunicação assíncrona via broker MQTT (test.mosquitto.org)
- **Alertas Visuais**: Sistema de alerta customizável com limite de temperatura
- **Histórico de 24h**: Armazenamento em JSON com limpeza automática
- **Exportação de Dados**: Download de histórico em formato CSV
- **Modo Fullscreen**: Visualização em tela cheia otimizada

## 🏗️ Arquitetura de 5 Camadas

```
┌─────────────────────────────────────────┐
│   APRESENTAÇÃO - Netlify/Web Dashboard  │  (index.html)
├─────────────────────────────────────────┤
│   IA/INTELIGÊNCIA - Node.js Analysis    │  (ia.js)
├─────────────────────────────────────────┤
│   COMUNICAÇÃO - MQTT Broker             │  (test.mosquitto.org)
├─────────────────────────────────────────┤
│   PROCESSAMENTO - ESP32 WiFi            │  (Climax.ard.ino)
├─────────────────────────────────────────┤
│   SENSORIAL - DHT22 Sensor              │  (Física)
└─────────────────────────────────────────┘
```

## 🔧 Componentes

### Hardware
- **ESP32**: Microcontrolador com WiFi e Bluetooth
- **DHT22**: Sensor digital de temperatura e umidade
- **LED de Status**: Indicador visual (GPIO 2)

### Software
- **Climax.ard.ino**: Firmware Arduino/ESP32 para leitura de sensores
- **ia.js**: Engine de análise em Node.js com MQTT
- **index.html**: Dashboard web interativo
- **banco_de_dados.json**: Armazenamento histórico local
- **gerar_documento.py**: Gerador de documentação em Word

### Plataformas
- **MQTT**: test.mosquitto.org:1883
- **Hosting**: [Netlify Dashboard](https://climaxtemp.netlify.app/)
- **Controle de Versão**: GitHub

## 📊 Dashboard

<img width="846" height="866" alt="Dashboard Climax" src="https://github.com/user-attachments/assets/7d615a09-7c72-493c-aa32-34b2fedca343" />

### Funcionalidades do Dashboard

- **Exibição em Tempo Real**: Temperatura e Umidade com atualizações a cada 30s
- **Recordes**: Máximas e mínimas do período
- **Relógio Digital**: Sincronizado com servidor
- **Status do Sistema**: Indicador de conexão WiFi (dBm)
- **Slider de Alerta**: Definir limite de temperatura customizado
- **Análise IA**: Exibição de tendências e anomalias detectadas
- **Gráfico Interativo**: 
  - Zoom com CTRL+Scroll
  - Pan (arraste) para navegar histórico
  - Pontos destacados dos dados mais recentes
- **Exportar CSV**: Download do histórico completo
- **Tela Cheia**: Modo fullscreen otimizado para apresentações

## 🚀 Como Funciona

### 1. **Coleta de Dados (ESP32)**
```
DHT22 Sensor → Leitura → WiFi → MQTT Publish
Intervalo: 30 segundos
Tópicos: climax/esp32/temperatura, climax/esp32/umidade
```

### 2. **Análise (Node.js)**
```
MQTT Subscribe → Validação → Análise
├─ Cálculo de média móvel
├─ Detecção de anomalias (>2°C ou >10% mudança)
└─ Previsão de tendências (1 hora)
Salvamento automático a cada 30s
```

### 3. **Apresentação (Web)**
```
MQTT WebSocket → Chart.js → Dashboard
├─ Gráficos em tempo real
├─ Alertas visuais
├─ Status do sistema
└─ Histórico com zoom/pan
```

## 📋 Tópicos MQTT

### Subscribe (Recebe)
- `climax/esp32/temperatura` - Leitura de temperatura
- `climax/esp32/umidade` - Leitura de umidade
- `climax/web/requisicao` - Requisições da interface web

### Publish (Envia)
- `climax/ia/mensagem` - Mensagens de análise da IA
- `climax/web/resposta` - Respostas para o dashboard
- `climax/web/pontografico` - Novo ponto para o gráfico
- `climax/node/status` - Status de heartbeat

## ⚙️ Configuração

### ESP32
```cpp
// WiFi
const char* ssid = "Redmi9";

// MQTT
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;

// Sensor
#define DHTPIN 4
#define DHTTYPE DHT22
```

### Node.js (ia.js)
```javascript
const broker = 'mqtt://test.mosquitto.org:1883';
const INTERVALO_SALVO = 30000; // 30 segundos
const LIMIT_ANOMALIA_T = 2;     // 2°C
const LIMIT_ANOMALIA_H = 10;    // 10%
```

### Dashboard (index.html)
```javascript
const broker = 'wss://test.mosquitto.org:8081';
const tempLimite = 30.0; // Padrão (customizável via slider)
```

## 📦 Instalação

### 1. Clonar Repositório
```bash
git clone https://github.com/Wellerson-M/Climax.git
cd Climax
```

### 2. Configurar ESP32
- Abrir `Climax.ard.ino` no Arduino IDE
- Instalar bibliotecas: `PubSubClient`, `DHT sensor library`, `Adafruit Unified Sensor`
- Configurar WiFi SSID/Password
- Upload para ESP32

### 3. Executar Node.js
```bash
npm install mqtt
node ia.js
```

### 4. Acessar Dashboard
- **Local**: Abrir `index.html` em um navegador
- **Online**: https://climaxtemp.netlify.app/

## 📊 Análise de Dados

### Detecção de Anomalias
- Compara leitura atual com média móvel de 5 pontos
- Alerta se: ΔT > 2°C ou ΔH > 10%
- Mensagem visual: "ALERTA" no dashboard

### Previsão de Tendência
```
y = a*x + b (regressão linear)
- Calcula coeficiente angular (taxa de mudança)
- Projeta 1 hora à frente
- Estados: Estável / Subindo / Descendo
```

### Histórico
- Janela deslizante de 24 horas
- ~2880 registros (1 a cada 30 segundos)
- Limpeza automática de dados antigos
- Armazenamento: `banco_de_dados.json`

## 🔒 Segurança

- MQTT via WebSocket Secure (wss://)
- Validação de dados de entrada
- Heartbeat monitoring (15 segundos timeout)
- Isolamento de componentes

## 📈 Performance

- **Latência**: < 1 segundo (MQTT)
- **Overhead**: ~50KB/dia de dados
- **Processamento**: < 50ms por ciclo
- **Uptime**: 24/7 com auto-restart

## 🐛 Troubleshooting

### ESP32 não conecta
- Verificar SSID e password do WiFi
- Confirmar distância do roteador
- Checar se MQTT broker está online

### Dashboard em branco
- Verificar console (F12)
- Confirmar conexão MQTT
- Limpar cache do navegador

### Node.js reclamando de porta
- Mudar porta em `ia.js` ou `index.html`
- Usar porta > 3000 para evitar conflitos

## 📝 Licença

Este projeto está disponível sob a licença MIT.

## 👥 Autor

**Wellerson Martins**
- GitHub: [@Wellerson-M](https://github.com/Wellerson-M)
- Projeto: Climax IoT Monitoring System

## 🔗 Links Úteis

- [Dashboard Online](https://climaxtemp.netlify.app/)
- [MQTT Broker](http://test.mosquitto.org/)
- [Chart.js Documentation](https://www.chartjs.org/)
- [ESP32 Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [Node.js MQTT](https://github.com/mqttjs/MQTT.js)

---

**Última Atualização**: 10/12/2025 | v1.2