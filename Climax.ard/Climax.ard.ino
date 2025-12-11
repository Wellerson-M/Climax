#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// --- DADOS DE WIFI ---
const char* ssid = "Redmi9";
const char* password = "12345678";

// --- CONFIGURAÇÕES MQTT ---
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;

// Tópicos
const char* topicTemp = "climax/esp32/temperatura";
const char* topicHum  = "climax/esp32/umidade";
const char* topicAI   = "climax/ia/mensagem";
const char* topicCmd  = "climax/comando";      
const char* topicRssi = "climax/esp32/rssi";   

// --- HARDWARE ---
#define DHTPIN 4      
#define DHTTYPE DHT22
#define LEDPIN 2      

WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

// --- VARIÁVEL DE CONTROLE NOVA ---
bool sistemaLigado = false; // Guarda o estado: true = Aceso Direto, false = Pisca-Pisca

void setup() {
  Serial.begin(115200);
  pinMode(LEDPIN, OUTPUT);
  
  // Pisca 3 vezes na inicialização
  for(int i=0; i<3; i++) {
    digitalWrite(LEDPIN, HIGH); delay(200);
    digitalWrite(LEDPIN, LOW);  delay(200);
  }

  dht.begin();
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.print("Conectando em "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LEDPIN, !digitalRead(LEDPIN));
    delay(500);
    Serial.print(".");
  }
  digitalWrite(LEDPIN, LOW);
  Serial.println("\nWiFi conectado!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Tentando conexao MQTT...");
    String clientId = "ESP32-Climax-" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("conectado!");
      client.subscribe(topicAI);  
      client.subscribe(topicCmd); 
      
      digitalWrite(LEDPIN, HIGH); delay(1000); digitalWrite(LEDPIN, LOW);
    } else {
      Serial.print("falhou, rc="); Serial.print(client.state()); delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];

  if (String(topic) == topicAI) {
     Serial.print("\n[IA DISSE]: "); Serial.println(msg);
  }

  // --- LÓGICA DO BOTÃO ---
  if (String(topic) == topicCmd) {
    if (msg == "LIGAR") {
      sistemaLigado = true;       // Marca como LIGADO
      digitalWrite(LEDPIN, HIGH); // Acende e deixa aceso
      Serial.println(">> LIGADO (LED Fixo)");
    } else if (msg == "DESLIGAR") {
      sistemaLigado = false;      // Marca como DESLIGADO (Volta a piscar)
      digitalWrite(LEDPIN, LOW);  // Apaga
      Serial.println(">> DESLIGADO (LED Piscante)");
    }
  }
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  static unsigned long lastMsg = 0;
  unsigned long now = millis();
  
  // Envia a cada 5 segundos
  if (now - lastMsg > 5000) { 
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    long rssi = WiFi.RSSI();

    if (isnan(h) || isnan(t)) {
      Serial.println("Falha ao ler o DHT!");
      return;
    }

    // --- A MÁGICA ACONTECE AQUI ---
    // Se o sistema NÃO estiver ligado pelo site (!sistemaLigado), ele dá uma piscadinha.
    // Se estiver ligado, ele pula esse bloco e o LED continua aceso (HIGH) como deixamos no callback.
    if (!sistemaLigado) {
        digitalWrite(LEDPIN, HIGH); 
        delay(100); 
        digitalWrite(LEDPIN, LOW);
    }

    client.publish(topicTemp, String(t).c_str());
    client.publish(topicHum, String(h).c_str());
    client.publish(topicRssi, String(rssi).c_str());
    
    Serial.print("Enviando T:"); Serial.print(t); Serial.print(" H:"); Serial.println(h);
  }
}