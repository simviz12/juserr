const http = require('http');

const URL = 'http://localhost:3001/login';
const TOTAL_REQUESTS = 300;
const CONCURRENCY = 30;

console.log(`🔥 Iniciando Prueba de Estrés Local en ${URL}`);
console.log(`🚀 Concurrencia: ${CONCURRENCY} usuarios simultáneos | Total Peticiones: ${TOTAL_REQUESTS}\n`);

let completed = 0;
let success = 0;
let errors = 0;
const latencies = [];
const startTime = Date.now();

function sendRequest() {
  const reqStart = Date.now();
  http.get(URL, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      latencies.push(Date.now() - reqStart);
      if (res.statusCode === 200) success++;
      else errors++;
      next();
    });
  }).on('error', (err) => {
    errors++;
    next();
  });
}

function next() {
  completed++;
  if (completed < TOTAL_REQUESTS) {
    sendRequest();
  } else if (completed === TOTAL_REQUESTS) {
    const totalTime = (Date.now() - startTime) / 1000;
    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const rps = (TOTAL_REQUESTS / totalTime).toFixed(2);

    console.log('--- RESULTADOS DE LA PRUEBA DE ESTRÉS ---');
    console.log(`✅ Peticiones Exitosas (HTTP 200): ${success}/${TOTAL_REQUESTS} (${((success/TOTAL_REQUESTS)*100).toFixed(1)}%)`);
    console.log(`❌ Errores / Caídas: ${errors}`);
    console.log(`⏱️ Tiempo Total de Prueba: ${totalTime.toFixed(2)} segundos`);
    console.log(`⚡ Rendimiento / Capacidad: ${rps} peticiones por segundo (RPS)`);
    console.log(`📊 Latencia Promedio: ${avg.toFixed(1)} ms`);
    console.log(`📊 Latencia p50 (Mediana): ${p50} ms`);
    console.log(`📊 Latencia p95: ${p95} ms`);
    console.log(`📊 Latencia p99: ${p99} ms`);
    console.log('-----------------------------------------');
  }
}

// Iniciar hilos de concurrencia
for (let i = 0; i < CONCURRENCY; i++) {
  sendRequest();
}
