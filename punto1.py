from flask import Flask, render_template, jsonify
from multiprocessing import Process, Queue, Manager
import numpy as np
from datetime import datetime
from zoneinfo import ZoneInfo
import time
import pandas as pd
import os

temp_actual = 16.0
humedad_actual = 81.0
presion_actual = 1013.25
colombia_tz = ZoneInfo("America/Bogota")

manager = None
datos_compartidos = None
q1 = None
q2 = None
p1 = None
p2 = None
p3 = None

def inicializar_multiprocessing():
    global manager, datos_compartidos, q1, q2
    if manager is None:
        manager = Manager()
        datos_compartidos = manager.list()
        q1 = Queue()
        q2 = Queue()

def obtener_datos(q1, q2, temp_actual, humedad_actual, presion_actual):
    while True:
        ahora_colombia = datetime.now(colombia_tz)
        temp_actual += np.random.normal(0, 0.5)
        humedad_actual += np.random.normal(0, 2)
        presion_actual += np.random.normal(0, 0.3)
        temp_actual = np.clip(temp_actual, -10, 50)
        humedad_actual = np.clip(humedad_actual, 0, 100)
        presion_actual = np.clip(presion_actual, 980, 1050)
        print(" Hilo1: Datos obtenidos")
        print(f"Proceso ID: {os.getpid()}")
        q1.put((
            ahora_colombia.strftime("%A, %d de %B de %Y - %I:%M:%S %p"),
            float(round(temp_actual, 2)),
            float(round(humedad_actual, 2)),
            float(round(presion_actual, 2))
        ))
        q2.put((
            ahora_colombia.strftime("%d de %B de %Y - %I:%M:%S %p"),
            float(round(temp_actual, 2)),
            float(round(humedad_actual, 2)),
            float(round(presion_actual, 2))
        ))
        time.sleep(1)

def crear_csv():
    df = pd.DataFrame(columns=['Tiempo', 'Temperatura', 'Humedad', 'Presion'])
    df.to_csv('datos_meteorologicos.csv', index=False)

def eliminar_csv():
    ruta_al_archivo = "datos_meteorologicos.csv"
    try:
        if os.path.exists(ruta_al_archivo):
            print("Archivo encontrado")
            os.remove(ruta_al_archivo)
            return jsonify({"status": "success", "message": "Archivo eliminado"}), 200
        else:
            return jsonify({"status": "error", "message": "El archivo no existe"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def confirmar_csv():
    ruta_al_archivo = "datos_meteorologicos.csv"
    if os.path.exists(ruta_al_archivo):
        return "1"
    else:
        return "0"

def registrar_dato(q1):
    while True:
        ultimo = None
        # Vaciar la cola
        while not q1.empty():
            ultimo = q1.get()

        if ultimo:
            tiempo, temperatura, humedad, presion = ultimo

            nuevo_dato = pd.DataFrame({
                'Tiempo': [tiempo],
                'Temperatura': [temperatura],
                'Humedad': [humedad],
                'Presion': [presion]
            })
            nuevo_dato.to_csv('datos_meteorologicos.csv', mode='a', header=False, index=False)
        print("Hilo 2: Datos cargados al CSV")
        print(f"Proceso ID: {os.getpid()}")
        time.sleep(5)

def visualizar_datos(q2, datos_compartidos):
    while True:
        ultimo = None

        # Vaciar cola y quedarse con el más reciente
        while not q2.empty():
            ultimo = q2.get()

        if ultimo:
            tiempo, temp, humedad, presion = ultimo

            if len(datos_compartidos) >= 7:
                del datos_compartidos[:]

            datos_compartidos.append({
                "tiempo": tiempo,
                "temperatura": temp,
                "humedad": humedad,
                "presion": presion
            })
        time.sleep(5)

def iniciar():
    global p1, p2, p3
    inicializar_multiprocessing()
    if p1 is None or not p1.is_alive():
        q1 = Queue() #nuevas colas cada vez que se finaliza el proceso y se requiere d enue
        q2 = Queue()
        p1 = Process(target=obtener_datos, args=(q1, q2, temp_actual, humedad_actual, presion_actual))
        p2 = Process(target=registrar_dato, args=(q1,))
        p3 = Process(target=visualizar_datos, args=(q2, datos_compartidos))
        p1.start()
        p2.start()
        p3.start()
        return "1"
    else:
        return "0"

def finalizar():
    global p1, p2, p3
    if p1 is not None and p1.is_alive():
        p1.terminate(); p1.join()
        p2.terminate(); p2.join()
        p3.terminate(); p3.join()
        p1 = None
        p2 = None
        p3 = None



        return "1"
    else:
        return "0"

app = Flask(__name__)

@app.route("/")
def hello_world():
    return render_template('index.html')

@app.route("/crearcsv")
def csv_crear():
    crear_csv()
    return "ok"

@app.route("/eliminarcsv")
def csv_eliminar():
    eliminar_csv()
    return "ok"

@app.route("/confirmarcsv")
def csv_confirmar():
    return jsonify({"confirmacion": confirmar_csv()})

@app.route("/iniciar")
def iniciar_procesos():
    return jsonify({"estado": iniciar()})

@app.route("/finalizar")
def detener_procesos():
    return jsonify({"estado": finalizar()})

@app.route("/datos")
def obtener_datos_graficas():
    if datos_compartidos is None:
        return jsonify([])
    return jsonify(list(datos_compartidos))

#  ruta para limpiar desde el JS
@app.route("/limpiar")
def limpiar_datos():
    if datos_compartidos is not None:
        del datos_compartidos[:]
    return "ok"

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)