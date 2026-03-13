# test-start.py – Windows-sichere Version (verbessert)

import os
import subprocess
import webbrowser
import time
import sys

def main():
    print("Starte NagVis 2...")

    # Backend-Verzeichnis
    backend_dir = r"C:\Users\ks84597\OneDrive - K+S Aktiengesellschaft\Documents\Git-Repos\nagvis-kurz-vor-2\prototypes"
    
    if not os.path.isdir(backend_dir):
        print("FEHLER: Backend-Verzeichnis nicht gefunden:", backend_dir)
        print("Bitte überprüfe den Pfad oder verschiebe das Repo aus OneDrive.")
        sys.exit(1)

    # Frontend-Verzeichnis (relativ zum Backend)
    frontend_dir = os.path.join(backend_dir, "nagvis2-prototype")
    
    if not os.path.isdir(frontend_dir):
        print("FEHLER: Frontend-Verzeichnis nicht gefunden:", frontend_dir)
        sys.exit(1)

    # Backend starten
    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app", "--reload", "--port", "8000"
    ]

    try:
        backend = subprocess.Popen(
            backend_cmd,
            cwd=backend_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
        print("✓ Backend gestartet → http://127.0.0.1:8000")
    except FileNotFoundError as e:
        print("✗ uvicorn nicht gefunden:", e)
        print("  Installiere: pip install uvicorn fastapi")
        sys.exit(1)

    time.sleep(4)

    # Frontend starten
    frontend_cmd = ["live-server", "--port=5500", "--open=index.html"]

    try:
        frontend = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir
        )
        print("✓ Frontend gestartet → http://127.0.0.1:5500")
    except FileNotFoundError:
        print("✗ npx/live-server nicht gefunden.")
        print("  Installiere Node.js oder starte manuell:")
        print(f"  cd {frontend_dir}")
        print("  npx live-server --port=5500")
        backend.terminate()
        sys.exit(1)

    time.sleep(3)
    webbrowser.open("http://127.0.0.1:5500/index.html")

    print("\n✓ Alles läuft! Beende mit Strg+C\n")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nBeende...")
        backend.terminate()
        frontend.terminate()
        time.sleep(1)
        print("Fertig.")

if __name__ == "__main__":
    main()
