# Kim Ne Yedi? 🍔 / 🌯 / 🍕

Can, Emir ve Kemal'in haftalık yemek günlüğü, kesintisiz yemek zinciri ve gurme durakları takip platformu.

🌐 **Canlı Site:** [https://emirarkali.github.io/kim-ne-yedi/](https://emirarkali.github.io/kim-ne-yedi/)
- **Can:** `?u=can` (Varsayılan)
- **Emir:** `?u=emir`
- **Kemal:** `?u=kemal`

---

## ✨ Özellikler

- 👥 **Çoklu Kullanıcı Desteği:** Can, Emir ve Kemal profilleri arasında tek dokunuşla geçiş.
- 🔥 **Yemek Zinciri (Streak):** Her kullanıcının gün gün ne yediyse zincir halinde kesintisiz takibi.
- 📱 **Mobil Uyumlu & Modern Arayüz:** Modern dark mode gurme teması, Tailwind CSS ve akıcı animasyonlar.
- 📍 **Konum ve Mekan Odaklı:** Yurt, McDonald's, Jungle Burger gibi öğünün nerede yendiği bilgisi.
- 🥤 **Çoklu Öğün Desteği:** Bir günde birden fazla öğün yendiğinde alt alta kartlar halinde listeleme.
- 🔍 **Arama ve Mekan Filtreleri:** Mekana veya yiyeceğe göre anlık filtreleme.
- 🤖 **Yapay Zekalı Telegram Botu:** Doğal dille ne yediğini ve fiyatını yazınca Gemini AI ile çözümlenip ilgili kullanıcının dosyasına anında işleme.

---

## 📅 Mevcut Veriler (19 Ekim 2026'dan İtibaren)

| Tarih | Gün | Öğün(ler) | Konum |
| :--- | :--- | :--- | :--- |
| **19 Ekim 2026** | Pazartesi | Hamburger + Ayran | Yurt |
| **20 Ekim 2026** | Salı | Hamburger + Fuse Tea Şeftali | McDonald's |
| **21 Ekim 2026** | Çarşamba | Hamburger + Fuse Tea Şeftali | McDonald's |
| **22 Ekim 2026** | Perşembe | 1. Tavuk Dürüm (Zater) + Kola<br>2. Hamburger + Ayran | Yurt<br>Jungle Burger |

---

## 🚀 Yeni Gün Nasıl Eklenir?

Yeni bir gün eklemek için tek yapmanız gereken ilgili kişinin dosyasına ([Can](data/meals/can.json), [Emir](data/meals/emir.json), [Kemal](data/meals/kemal.json)) en alta (veya uygun tarih sırasına) yeni bir gün eklemektir:

```json
{
  "date": "2026-10-23",
  "day": "Cuma",
  "meals": [
    {
      "id": "2026-10-23-1",
      "title": "Hamburger + Kola",
      "items": ["Hamburger", "Kola"],
      "location": "McDonald's",
      "category": "Fast Food",
      "emoji": "🍔",
      "note": "İstikrar devam ediyor"
    }
  ]
}
```

Değişikliği kaydedip pushladıktan sonra site otomatik olarak güncellenir:

```bash
git add data/meals/can.json
git commit -m "feat: 23 Ekim Cuma öğünü eklendi"
git push origin main
```

---

## 🤖 Telegram Botu ile Otomatik Ekleme

Telefondan Telegram'a doğal dille yazarak siteye otomatik ekleme yapmak için [telegram-bot/README.md](telegram-bot/README.md) kılavuzuna göz atabilirsiniz.

---

Geliştirici: [@emirarkali](https://github.com/emirarkali)

