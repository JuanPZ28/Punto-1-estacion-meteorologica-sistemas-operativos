let intervaloDatos = null;
let graficaTemp, graficaHumedad, graficaPresion;

function limpiarGraficas() {
    [graficaTemp, graficaHumedad, graficaPresion].forEach(g => {
        g.data.labels = [];
        g.data.datasets[0].data = [];
        g.update();
    });
}

function crearGrafica(idCanvas, label, color) {

    const instanciaExistente = Chart.getChart(idCanvas);
    if (instanciaExistente) {
        instanciaExistente.destroy();
    }

    const ctx = document.getElementById(idCanvas).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color + '33',
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: { ticks: { maxTicksLimit: 10 } }
            }
        }
    });
}

function actualizarGrafica(grafica, tiempos, valores) {
    grafica.data.labels = tiempos;
    grafica.data.datasets[0].data = valores;
    grafica.update();
}

async function fetchDatos() {
    try {
        const response = await fetch('/datos');
        const datos = await response.json();
        if (datos.length === 0) return;

        const tiempos   = datos.map(d => d.tiempo.split(" ")[6] );
        const temps     = datos.map(d => d.temperatura);
        const humedades = datos.map(d => d.humedad);
        const presiones = datos.map(d => d.presion);

        actualizarGrafica(graficaTemp,    tiempos, temps);
        actualizarGrafica(graficaHumedad, tiempos, humedades);
        actualizarGrafica(graficaPresion, tiempos, presiones);

        let panel1 = document.getElementById("log-panel1");
        let panel2 = document.getElementById("log-panel2");
        let panel3 = document.getElementById("log-panel3");

        datos.forEach(d => {
            panel1.innerHTML += `${d.tiempo} — Temp: ${d.temperatura}°C <br>`; //Llama por los ids de los datos del arreglo compartido
            panel2.innerHTML += `${d.tiempo} — Humedad: ${d.humedad}% <br>`;
            panel3.innerHTML += `${d.tiempo} — Presión: ${d.presion} hPa <br>`;
        });

        // Scroll al final
        panel1.scrollTop = panel1.scrollHeight;
        panel2.scrollTop = panel2.scrollHeight;
        panel3.scrollTop = panel3.scrollHeight;

    } catch (error) {
        console.error("Error al obtener datos:", error);
    }
}

document.addEventListener("DOMContentLoaded", async function () {

    ['graficaTemperatura', 'graficaHumedad', 'graficaPresion'].forEach(id => {
        const instancia = Chart.getChart(id);
        if (instancia) instancia.destroy();
    });

    // botones 
    const btncrear    = document.getElementById('crearcsv');
    const btneliminar = document.getElementById('eliminarcsv');
    const btniniciar  = document.getElementById('Iniciar_procesos');
    const btndetener  = document.getElementById('Detener_procesos');

    // graficas
    graficaTemp    = crearGrafica('graficaTemperatura', 'Temperatura (°C)', '#e74c3c');
    graficaHumedad = crearGrafica('graficaHumedad',     'Humedad (%)',      '#3498db');
    graficaPresion = crearGrafica('graficaPresion',     'Presión (hPa)',    '#2ecc71');

    // Confirmacion CSV
    try {
        const response = await fetch('/confirmarcsv');
        const data = await response.json();
        if (data.confirmacion == "1") {
            btncrear.textContent    = 'CSV creado';
            btncrear.disabled       = true;
            btneliminar.textContent = 'Eliminar CSV';
            btneliminar.disabled    = false;
            btniniciar.disabled     = false;
            btndetener.disabled     = false;
        } else {
            btneliminar.textContent = 'CSV eliminado';
            btneliminar.disabled    = true;
            btncrear.textContent    = 'Crear CSV';
            btncrear.disabled       = false;
            btniniciar.disabled     = true;
            btndetener.disabled     = true;
        }
    } catch (error) {
        console.error("Error:", error);
    }

    if (btncrear) {
        btncrear.addEventListener('click', async function () {
            await fetch('/crearcsv');
            alert("Archivo CSV creado");
            btncrear.textContent    = 'CSV creado';
            btncrear.disabled       = true;
            btneliminar.textContent = 'Eliminar CSV';
            btneliminar.disabled    = false;
            btniniciar.disabled     = false;
            btndetener.disabled     = false;
        });
    }

    if (btneliminar) {
        btneliminar.addEventListener('click', async function () {
            let respuesta = confirm("¿Estas seguro de que quieres eliminar el archivo CSV?");
            if (!respuesta) { alert("Cancelado"); return; }
            try {
                await fetch('/eliminarcsv');
                alert("Archivo eliminado");
                limpiarGraficas();
                btneliminar.textContent = 'CSV Eliminado';
                btneliminar.disabled    = true;
                btncrear.textContent    = 'Crear CSV';
                btncrear.disabled       = false;
                btniniciar.disabled     = true;
                btndetener.disabled     = true;
            } catch (error) {
                console.error(error);
                alert("Error al eliminar el archivo");
            }
        });
    }

    if (btniniciar) {
        btniniciar.addEventListener('click', async function () {
            const response = await fetch('/iniciar');
            const data = await response.json();
            if (data.estado == "1") {
                alert("Sensores encendidos");
                btneliminar.disabled = true;
                if (intervaloDatos === null) {
                    intervaloDatos = setInterval(fetchDatos, 5000);
                }
            } else {
                alert("Los sensores estan encendidos");
            }
        });
    }

    if (btndetener) {
        btndetener.addEventListener('click', async function () {
            const response = await fetch('/finalizar');
            const data = await response.json();
            if (data.estado == "1") {
                alert("Sensores apagados");
                btneliminar.disabled = false;
                if (intervaloDatos !== null) {
                    clearInterval(intervaloDatos);
                    intervaloDatos = null;
                } 
                
            } else {
                alert("Los sensores se encuentran apagados");
            }
        });
    }

});