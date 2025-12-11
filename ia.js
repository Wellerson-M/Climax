const mqtt = require("mqtt");
const fs = require("fs");

// --- CONFIGURAÇÃO ---
const broker = "mqtt://test.mosquitto.org";
const ARQUIVO_DADOS = "banco_de_dados.json";

// Tópicos
const topicTemp = "climax/esp32/temperatura";
const topicHum  = "climax/esp32/umidade";
const topicAI   = "climax/ia/mensagem";
const topicReq  = "climax/web/requisicao"; 
const topicRes  = "climax/web/resposta";
const topicHeartbeat = "climax/node/status";
const topicGrafico = "climax/web/pontografico"; // Tópico exclusivo do gráfico

const client = mqtt.connect(broker);

// --- MEMÓRIA ---
let historico = carregarOuGerarDados();
const JANELA_TEMPO_MS = 24 * 60 * 60 * 1000; 
const LIMITE_BRUSCO_TEMP = 2.0;
const LIMITE_BRUSCO_HUM  = 10.0;

let lastTemp = 0, lastHum = 0;
let ultimoSinalSensor = Date.now();
let sistemaOnline = false;
let ultimoSave = 0;

// --- FUNÇÕES ---
function carregarOuGerarDados() {
    try {
        if (fs.existsSync(ARQUIVO_DADOS)) {
            return JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
        }
    } catch (e) {}
    return gerarDadosFalsos();
}

function salvarDados() {
    if (historico.length > 2000) historico = historico.slice(-2000); 
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(historico));
}

function gerarDadosFalsos() {
    let fake = [];
    let agora = Date.now();
    let tBase = 25, hBase = 60;
    // Gera dados de 1 hora atrás (a cada 30s)
    for(let i=120; i>0; i--) {
        fake.push({
            time: agora - (i * 30 * 1000),
            temp: tBase + (Math.random() * 3 - 1.5),
            hum: hBase + (Math.random() * 10 - 5)
        });
    }
    return fake;
}

function atualizarHistorico(t, h) {
    const agora = Date.now();
    // Salva a cada 30 segundos
    if (agora - ultimoSave > 30000) {
        historico.push({ temp: t, hum: h, time: agora });
        historico = historico.filter(d => (agora - d.time) <= JANELA_TEMPO_MS);
        salvarDados();
        ultimoSave = agora;
        return true; // Retorna true para avisar que salvou
    }
    return false;
}

function calcularMedia(d){if(d.length===0)return 0;return d.reduce((a,b)=>a+b,0)/d.length;}

function analisarTendencia() {
    if (historico.length < 10) return "Calculando...";
    const fim = historico.slice(-3);
    const inicio = historico.slice(0, 3);
    
    const mtF = calcularMedia(fim.map(d=>d.temp)), mtI = calcularMedia(inicio.map(d=>d.temp));
    const mhF = calcularMedia(fim.map(d=>d.hum)), mhI = calcularMedia(inicio.map(d=>d.hum));
    const dt = (fim[fim.length-1].time - inicio[0].time) / 60000;
    
    if (dt < 1) return "Aguardando histórico...";

    const taxT = (mtF - mtI) / dt * 60;
    const taxH = (mhF - mhI) / dt * 60;
    const projT = mtF + taxT;
    const projH = mhF + taxH;

    let txtT = Math.abs(taxT)<0.5 ? "Estável" : `${taxT.toFixed(1)}°C/h`;
    let txtH = Math.abs(taxH)<2.0 ? "Estável" : `${taxH.toFixed(1)}%/h`;
    let projHFinal = projH > 100 ? 100 : projH;

    return `Tendência T: ${txtT} (Proj 1h: ${projT.toFixed(1)}°C)\nTendência H: ${txtH} (Proj 1h: ${projHFinal.toFixed(0)}%)`;
}

function detectarAnomalia(t, h) {
    if (historico.length < 5) return null;
    const recente = historico.slice(-5);
    const mt = calcularMedia(recente.map(d=>d.temp));
    const mh = calcularMedia(recente.map(d=>d.hum));

    let alertas = [];
    if (Math.abs(t - mt) > LIMITE_BRUSCO_TEMP) alertas.push(`ALERTA: Salto Temp (${Math.abs(t-mt).toFixed(1)}°C)`);
    if (Math.abs(h - mh) > LIMITE_BRUSCO_HUM) alertas.push(`ALERTA: Salto Umid (${Math.abs(h-mh).toFixed(1)}%)`);
    if (alertas.length > 0) return alertas.join("\n");
    return null;
}

// --- MQTT ---
client.on("connect", () => {
    console.log("📡 NODE ONLINE (Save: 30s)");
    client.subscribe(topicTemp);
    client.subscribe(topicHum);
    client.subscribe(topicReq);
    
    setInterval(() => client.publish(topicHeartbeat, "ON"), 3000); // Heartbeat

    // Watchdog
    setInterval(() => {
        if (Date.now() - ultimoSinalSensor > 15000 && sistemaOnline) {
            sistemaOnline = false;
            client.publish(topicAI, "🔴 SENSOR OFFLINE\nVerifique energia do ESP32.");
        }
    }, 2000);
});

client.on("message", (topic, message) => {
    const msg = message.toString();

    if (topic === topicReq) client.publish(topicRes, JSON.stringify(historico));

    if (topic === topicTemp || topic === topicHum) {
        ultimoSinalSensor = Date.now();
        sistemaOnline = true;
        if (topic === topicTemp) lastTemp = parseFloat(msg);
        if (topic === topicHum) lastHum = parseFloat(msg);

        if (topic === topicHum && lastTemp !== 0) {
            // Tenta salvar (Logica dos 30s)
            const salvou = atualizarHistorico(lastTemp, lastHum);
            
            const txtTendencia = analisarTendencia();
            const txtAlerta = detectarAnomalia(lastTemp, lastHum);

            let msgFinal = txtAlerta ? `⚠️ ${txtAlerta}\nValores: ${lastTemp}°C / ${lastHum}%` : `🟢 ONLINE | Status: Normal\n${txtTendencia}`;
            
            client.publish(topicAI, msgFinal);

            // SE salvou (passou 30s), manda pro gráfico
            if (salvou) {
                console.log(`[GRAVADO] ${lastTemp}°C / ${lastHum}%`);
                const pacote = JSON.stringify({t: lastTemp, h: lastHum, time: Date.now()});
                client.publish(topicGrafico, pacote);
            }
        }
    }
});