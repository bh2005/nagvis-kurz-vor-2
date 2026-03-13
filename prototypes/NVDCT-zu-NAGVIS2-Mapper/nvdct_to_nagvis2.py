#!/usr/bin/env python3
import json
import os
import sys

# Pfade (Anpassen an deine Site-Umgebung)
NVDCT_INPUT = "data_host.json"  # Standard-Output von NVDCT
NAGVIS2_OUTPUT = "nagvis_v2_map.json"

def transform_topology():
    if not os.path.exists(NVDCT_INPUT):
        print(f"Fehler: {NVDCT_INPUT} nicht gefunden. Läuft NVDCT bereits?")
        return

    try:
        with open(NVDCT_INPUT, "r") as f:
            nvdct_data = json.load(f)

        # NagVis 2.0 Zielstruktur
        nagvis_map = {
            "metadata": {
                "name": "NVDCT Auto-Map",
                "created": "2026-03-13",
                "type": "dynamic"
            },
            "nodes": [],
            "edges": []
        }

        # 1. Nodes transformieren
        # NVDCT nutzt oft 'nodes', wir mappen das auf ein sauberes Frontend-Format
        for node in nvdct_data.get("nodes", []):
            nagvis_map["nodes"].append({
                "id": node.get("id"),
                "label": node.get("name", node.get("id")),
                "type": node.get("metadata", {}).get("type", "host"),
                "status": 0, # Placeholder für Live-Status (0=OK)
                "icon": "server" # Logik für Icons könnte hier erweitert werden
            })

        # 2. Edges (Links) transformieren
        for link in nvdct_data.get("links", []):
            nagvis_map["edges"].append({
                "source": link.get("source"),
                "target": link.get("target"),
                "label": link.get("metadata", {}).get("interface", ""),
                "state": "active"
            })

        # Output speichern
        with open(NAGVIS2_OUTPUT, "w") as f:
            json.dump(nagvis_map, f, indent=4)

        print(f"Erfolg! {len(nagvis_map['nodes'])} Nodes und {len(nagvis_map['edges'])} Links nach {NAGVIS2_OUTPUT} exportiert.")

    except Exception as e:
        print(f"Fehler bei der Transformation: {e}")

if __name__ == "__main__":
    transform_topology()