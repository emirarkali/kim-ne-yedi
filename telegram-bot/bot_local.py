#!/usr/bin/env python3
"""
Kim Ne Yedi? - Çok Kullanıcılı Yerel Telegram Botu (Polling Yöntemi)

Gereksinimler:
pip install requests

Kullanım:
export TELEGRAM_BOT_TOKEN="bot_tokeniniz"
export GEMINI_API_KEY="gemini_api_anahtariniz"
export ALLOWED_CHAT_ID="telegram_chat_id" # opsiyonel

python3 telegram-bot/bot_local.py
"""

import os
import sys
import json
import time
import subprocess
from datetime import datetime
import requests

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

USER_PROFILES = {
    "can": {
        "id": "can",
        "name": "Can",
        "emoji": "🍔",
        "file": os.path.join(REPO_DIR, "data", "meals", "can.json"),
        "telegram": ["fifonee"]
    },
    "emir": {
        "id": "emir",
        "name": "Emir",
        "emoji": "🌯",
        "file": os.path.join(REPO_DIR, "data", "meals", "emir.json"),
        "telegram": ["emirarkali"]
    },
    "kemal": {
        "id": "kemal",
        "name": "Kemal",
        "emoji": "🍕",
        "file": os.path.join(REPO_DIR, "data", "meals", "kemal.json"),
        "telegram": ["kemalkyy"]
    }
}

ALLOWED_USERNAMES = ["emirarkali", "fifonee", "kemalkyy"]
chat_active_profiles = {}  # chat_id -> profile_id

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
ALLOWED_CHAT_ID = os.environ.get("ALLOWED_CHAT_ID")

if not TELEGRAM_BOT_TOKEN or not GEMINI_API_KEY:
    print("UYARI: TELEGRAM_BOT_TOKEN veya GEMINI_API_KEY ortam değişkeni ayarlanmamış!")
    print("Lütfen bu değişkenleri ayarlayıp tekrar çalıştırın.")

def get_profile_for_chat(chat_id, username=""):
    if chat_id in chat_active_profiles:
        pid = chat_active_profiles[chat_id]
        if pid in USER_PROFILES:
            return USER_PROFILES[pid]
    clean_u = (username or "").lower().replace("@", "")
    for prof in USER_PROFILES.values():
        if any(u.lower() == clean_u for u in prof["telegram"]):
            return prof
    return USER_PROFILES["can"]

def send_telegram_msg(chat_id, text, parse_mode="Markdown"):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Telegram mesaj gönderme hatası: {e}")

chat_pending_meals = {}   # chat_id -> pending_data

def parse_with_gemini(user_text, prev_context=None):
    now = datetime.now()
    day_names = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    today_date = now.strftime("%Y-%m-%d")
    today_day = day_names[now.weekday()]

    prompt = f"""
Sen bir yemek günlüğü asistanısın. Kullanıcının Türkçe yemek mesajını analiz et.
Bugünün tarihi: {today_date} ({today_day}).

Gerekli Temel Öğün Bilgileri:
1. "title": Yiyecek ve içecek (Ne yedi/içti)
2. "location": Nerede yediği / mekan (Yurt, McDonald's, Zater, Ev, Kantin vb.)
3. "price": Fiyatı (örn: "36 TL", "Beleş TL" vb.)

Kurallar:
- Eğer kullanıcı önceki sorulan bir soruya cevap veriyorsa, cevabını eksik olan alana ata. Örn: Mekan sorulduysa ve kullanıcı "Zater" dediyse mekan = "Zater" olur. Fiyat sorulduysa ve "140" dediyse fiyat = "140 TL" olur.
- Eğer kullanıcı "bilmiyorum", "boşver", "fark etmez", "hatırlamıyorum" veya "yok" dediyse eksik alana "Bilinmiyor" (fiyat için "Belirtilmedi") yazıp tamamla.
- Eğer yiyecek, fiyat veya mekandan BİRİ VEYA BİRDEN FAZLASI EKSİKSE (ve kullanıcı pas geçmediyse):
  "isComplete": false yap, eksik alanları "missingFields" listesine koy ve "question" alanına eksik bilgileri kullanıcıya soran sıcak, samimi ve kısa bir soru yaz (örn: "Cipsi not aldım 🍟 Peki nerede yedin ve fiyatı ne kadardı?").
- Eğer temel bilgiler TAMAMLANDIYSA:
  "isComplete": true yap, "question": null yap.
- "note": Varsa lezzet, beğeni veya durum yorumu (örn: "Tadı güzeldi ama hızlı bitiyor"), yoksa "".
- "emoji": Yemeğe en uygun tek bir emoji (örn: 🍔, 🍕, 🌯, 🍟, 🍽️).
- "category": Uygun kategori (örn: "Fast Food", "Dürüm & Çiğ Köfte", "Atıştırmalık", "Tatlı", "Ev Yemeği").

Çıktı SADECE geçerli bir JSON olmalıdır:
{{
  "isComplete": true,
  "missingFields": [],
  "question": null,
  "date": "{today_date}",
  "day": "{today_day}",
  "meal": {{
    "title": "Cips",
    "items": ["Cips"],
    "location": "Yurt",
    "price": "36 TL",
    "category": "Atıştırmalık",
    "emoji": "🍟",
    "note": ""
  }}
}}
"""
    if prev_context:
        user_content = f"Önceki Bilgiler ve Eksikler:\n{json.dumps(prev_context, ensure_ascii=False)}\n\nKullanıcının Yeni Yanıtı: \"{user_text}\""
    else:
        user_content = f"Kullanıcı: \"{user_text}\""

    models = [
        {"name": "gemini-flash-lite-latest"},
        {"name": "gemini-3.5-flash", "budget": 0},
        {"name": "gemini-flash-latest", "budget": 0},
        {"name": "gemini-3.8-flash", "budget": 0}
    ]

    for m in models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m['name']}:generateContent?key={GEMINI_API_KEY}"
            gen_config = {"responseMimeType": "application/json", "maxOutputTokens": 1000}
            if "budget" in m:
                gen_config["thinkingConfig"] = {"thinkingBudget": m["budget"]}

            body = {
                "contents": [{"parts": [{"text": f"{prompt}\n\n{user_content}"}]}],
                "generationConfig": gen_config
            }
            resp = requests.post(url, json=body, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw_json)
        except Exception as e:
            continue

    raise RuntimeError("Gemini servisi meşgul.")

def update_meals_and_push(parsed, profile):
    file_path = profile["file"]
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                meals_data = json.load(f)
            except Exception:
                meals_data = []
    else:
        meals_data = []

    target_date = parsed["date"]
    target_day = parsed["day"]
    meal_obj = parsed["meal"]
    meal_obj["id"] = f"{target_date}-{int(time.time()) % 10000}"

    day_entry = next((d for d in meals_data if d["date"] == target_date), None)
    if day_entry:
        day_entry["meals"].append(meal_obj)
    else:
        meals_data.append({
            "date": target_date,
            "day": target_day,
            "meals": [meal_obj]
        })

    meals_data.sort(key=lambda x: x["date"])

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(meals_data, f, ensure_ascii=False, indent=2)

    # Can profili ise data/meals.json dosyasını da senkron tut
    if profile["id"] == "can":
        legacy_path = os.path.join(REPO_DIR, "data", "meals.json")
        with open(legacy_path, "w", encoding="utf-8") as f:
            json.dump(meals_data, f, ensure_ascii=False, indent=2)
        subprocess.run(["git", "add", "data/meals.json"], cwd=REPO_DIR, check=False)

    rel_file = os.path.relpath(file_path, REPO_DIR)
    subprocess.run(["git", "add", rel_file], cwd=REPO_DIR, check=True)
    commit_msg = f"feat({profile['id']}): {target_day} öğünü eklendi ({meal_obj['title']})"
    subprocess.run(["git", "commit", "-m", commit_msg], cwd=REPO_DIR, check=True)
    subprocess.run(["git", "push", "origin", "main"], cwd=REPO_DIR, check=True)
    return meal_obj

def poll_updates():
    offset = 0
    print("🚀 Çok kullanıcılı Telegram botu başlatıldı ve mesajlar dinleniyor...")
    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={offset}&timeout=30"
            res = requests.get(url, timeout=35).json()
            if not res.get("ok"):
                time.sleep(3)
                continue

            for update in res.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message")
                if not msg or "text" not in msg:
                    continue

                chat_id = msg["chat"]["id"]
                from_user = msg.get("from", {}).get("username", "")
                user_text = msg["text"].strip()

                if ALLOWED_CHAT_ID and str(chat_id) != str(ALLOWED_CHAT_ID):
                    if from_user.lower() not in ALLOWED_USERNAMES:
                        send_telegram_msg(chat_id, "⛔ Bu bot sadece yetkili kullanıcılar içindir.")
                        continue

                active_prof = get_profile_for_chat(chat_id, from_user)

                # /profil komutu
                if user_text.startswith("/profil") or user_text.startswith("profil"):
                    parts = user_text.split()
                    if len(parts) > 1:
                        target = parts[1].lower().replace("@", "")
                        if target in USER_PROFILES:
                            chat_active_profiles[chat_id] = target
                            p = USER_PROFILES[target]
                            send_telegram_msg(chat_id, f"✅ Aktif profil değiştirildi: {p['emoji']} *{p['name']}*\n\n🌐 https://emirarkali.github.io/kim-ne-yedi/?u={p['id']}")
                        else:
                            send_telegram_msg(chat_id, f"⚠️ Profil bulunamadı. Seçenekler: can, emir, kemal")
                    else:
                        send_telegram_msg(chat_id, f"👤 Aktif Profil: {active_prof['emoji']} *{active_prof['name']}*\n\nDeğiştirmek için: `profil can`, `profil emir` veya `profil kemal` yazabilirsiniz.")
                    continue

                # İptal kontrolü
                cancel_text = user_text.lower().replace("i", "ı").replace("/", "").strip()
                if cancel_text in ["iptal", "vazgec", "vazgeç", "cancel", "stop"]:
                    chat_pending_meals.pop(chat_id, None)
                    send_telegram_msg(chat_id, "🚫 İşlem iptal edildi.")
                    continue

                # /start ve /yardim
                if user_text in ["/start", "/yardim"]:
                    send_telegram_msg(chat_id, f"🍽️ *Kim Ne Yedi? Botu*\n👤 Aktif Profil: {active_prof['emoji']} *{active_prof['name']}*\n\nNe yediğini doğal dille yaz, siteye otomatik ekleyeyim!\nÖrn: `Yurtta tavuk dürüm ve kola gömdüm 240 TL`\n\nEksik bir bilgi olursa sana sorup tamamlayabilirim!\nProfil değiştirmek için: `profil emir`")
                    continue

                prev_data = chat_pending_meals.get(chat_id)
                send_telegram_msg(chat_id, f"⏳ {active_prof['name']} için öğün analiz ediliyor...")
                try:
                    parsed = parse_with_gemini(user_text, prev_data)
                    if not parsed.get("isComplete", True):
                        chat_pending_meals[chat_id] = parsed
                        send_telegram_msg(chat_id, f"{parsed['question']}\n\n💡 _Vazgeçmek için /iptal yazabilirsin._")
                        continue

                    chat_pending_meals.pop(chat_id, None)
                    meal = update_meals_and_push(parsed, active_prof)
                    price_display = meal.get("price") or "Belirtilmedi"
                    success_text = (
                        f"✅ *Harika, {active_prof['name']}'ın günlüğüne eklendi!* ({active_prof['emoji']})\n\n"
                        f"📅 *Tarih:* {parsed['day']} ({parsed['date']})\n"
                        f"{meal.get('emoji', '🍽️')} *Öğün:* {meal['title']}\n"
                        f"📍 *Konum:* {meal['location']}\n"
                        f"💰 *Fiyat:* {price_display}\n"
                        f"🏷️ *Kategori:* {meal['category']}\n\n"
                        f"🌐 https://emirarkali.github.io/kim-ne-yedi/?u={active_prof['id']}"
                    )
                    send_telegram_msg(chat_id, success_text)
                except Exception as err:
                    print("Hata:", err)
                    send_telegram_msg(chat_id, f"❌ Bir hata oluştu: {err}")

        except Exception as e:
            print(f"Polling loop hatası: {e}")
            time.sleep(3)

if __name__ == "__main__":
    poll_updates()
