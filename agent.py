#!/usr/bin/env python3
"""
MC Panel Agent — Debian'da çalışır, sistem metriklerini HTTP ile sunar.
Kurulum:
    pip3 install flask psutil --break-system-packages
Çalıştırma:
    python3 agent.py
Arka planda çalıştırmak için:
    nohup python3 agent.py &
    veya systemd servisi olarak kur (aşağıda açıklama var)
"""

import os
import time
import json
import psutil
from flask import Flask, jsonify

app = Flask(__name__)

AGENT_PORT = 7842       # Windows tarafında bu portla bağlanacaksın
AGENT_HOST = "0.0.0.0"  # Tüm arayüzlerden kabul et (local ağdan erişim için)
VERSION = "1.0.0"
START_TIME = time.time()

# Minecraft sunucu klasörü (boyut hesabı için), kendi yolunla değiştir
MC_SERVER_DIR = os.path.expanduser("~/mc")


def dir_size(path):
    """Klasör boyutunu byte olarak döner."""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except (OSError, FileNotFoundError):
                    pass
    except (OSError, FileNotFoundError):
        pass
    return total


@app.route("/ping")
def ping():
    return jsonify({"ok": True, "version": VERSION})


@app.route("/metrics")
def metrics():
    cpu = psutil.cpu_percent(interval=0.2)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    uptime = time.time() - START_TIME

    # CPU çekirdek sayısı
    cpu_cores = psutil.cpu_count(logical=False) or 1
    cpu_logical = psutil.cpu_count(logical=True) or 1

    # Minecraft klasör boyutu (isteğe bağlı, yavaş olabilir büyük sunucularda)
    mc_size = dir_size(MC_SERVER_DIR) if os.path.isdir(MC_SERVER_DIR) else 0

    return jsonify({
        "cpu_percent":   round(cpu, 1),
        "cpu_cores":     cpu_cores,
        "cpu_logical":   cpu_logical,
        "ram_used":      ram.used,
        "ram_total":     ram.total,
        "ram_percent":   round(ram.percent, 1),
        "disk_used":     disk.used,
        "disk_total":    disk.total,
        "disk_percent":  round(disk.percent, 1),
        "mc_size":       mc_size,
        "uptime_seconds": int(uptime),
        "version":       VERSION,
    })


@app.route("/ops")
def ops():
    """ops.json dosyasından op listesini okur."""
    ops_path = os.path.join(MC_SERVER_DIR, "ops.json")
    try:
        with open(ops_path, "r") as f:
            data = json.load(f)
        names = [entry.get("name", "") for entry in data if entry.get("name")]
        return jsonify({"ops": names})
    except FileNotFoundError:
        return jsonify({"ops": [], "error": "ops.json bulunamadı"})
    except Exception as e:
        return jsonify({"ops": [], "error": str(e)})

@app.route("/log")
def log():
    """latest.log dosyasından son satırları okur."""
    # Log dosyasının yolunu MC_SERVER_DIR üzerinden otomatik buluyoruz
    log_path = os.path.join(MC_SERVER_DIR, "logs", "latest.log")
    
    try:
        if not os.path.exists(log_path):
            return jsonify({"lines": [], "error": "latest.log bulunamadı"})
        
        # errors="replace" kısmı bozuk log karakterlerinde scriptin çökmesini engeller
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            # Dosyadaki son 50 satırı alıyoruz
            lines = f.readlines()[-50:]
            
        return jsonify({"lines": [line.strip() for line in lines]})
    except Exception as e:
        return jsonify({"lines": [], "error": str(e)})

if __name__ == "__main__":
    print(f"MC Panel Agent v{VERSION} başlatılıyor...")
    print(f"Port: {AGENT_PORT}")
    print(f"MC Klasörü: {MC_SERVER_DIR}")
    print("Durdurmak için: Ctrl+C")
    print("-" * 40)
    app.run(host=AGENT_HOST, port=AGENT_PORT, debug=False)
