# start.py – Startet Backend + Frontend mit einem Befehl
import os
import subprocess
import webbrowser
import time

def main():
    print("Starte NagVis 2...")

    # Backend starten
    backend = subprocess.Popen(
        ["uvicorn", "main:app", "--reload", "--port", "8000"],
        cwd="backend"  # oder wo deine main.py liegt
    )

    time.sleep(2)  # Warte bis Backend läuft

    # Frontend starten
    frontend = subprocess.Popen(
        ["npx", "live-server", "--port=5500", "--open=index.html", "prototypes/Index-draft"]
    )

    time.sleep(3)
    webbrowser.open("http://127.0.0.1:5500/index.html")

    print("Backend: http://127.0.0.1:8000")
    print("Frontend: http://127.0.0.1:5500")
    print("Beende mit Strg+C")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        backend.terminate()
        frontend.terminate()
        print("\nBeendet.")

if __name__ == "__main__":
    main()