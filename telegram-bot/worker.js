
const REPO_OWNER = "emirarkali";
const REPO_NAME = "kim-ne-yedi";
const GITHUB_BRANCH = "main";

// 👥 Kullanıcı Profilleri
const USER_PROFILES = {
  "can": {
    id: "can",
    name: "Can",
    emoji: "🍔",
    filePath: "data/meals/can.json",
    telegramUsernames: ["fifonee"]
  },
  "emir": {
    id: "emir",
    name: "Emir",
    emoji: "🌯",
    filePath: "data/meals/emir.json",
    telegramUsernames: ["emirarkali"]
  },
  "kemal": {
    id: "kemal",
    name: "Kemal",
    emoji: "🍕",
    filePath: "data/meals/kemal.json",
    telegramUsernames: ["kemalkyy"]
  }
};

const ALLOWED_USERNAMES = ["emirarkali", "fifonee", "kemalkyy"];
const userSessions = new Map();
const userActiveProfiles = new Map(); // chatId -> profileId ("can" | "emir" | "kemal")
const processedUpdateIds = new Set();

function getActiveProfile(chatId, fromUsername = "") {
  // 1. Kullanıcı bu sohbette profil seçmişse
  if (userActiveProfiles.has(chatId)) {
    const pid = userActiveProfiles.get(chatId);
    if (USER_PROFILES[pid]) return USER_PROFILES[pid];
  }
  // 2. Telegram kullanıcı adına göre eşleştir
  const clean = (fromUsername || "").toLowerCase().replace("@", "");
  for (const prof of Object.values(USER_PROFILES)) {
    if (prof.telegramUsernames.some(u => u.toLowerCase() === clean)) {
      return prof;
    }
  }
  // 3. Varsayılan olarak Can profili
  return USER_PROFILES["can"];
}

function getTurkeyTimeInfo(offsetDays = 0) {
  const now = new Date();
  if (offsetDays !== 0) {
    now.setDate(now.getDate() + offsetDays);
  }
  const trDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const dayNamesTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const trDateObj = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const trDayName = dayNamesTr[trDateObj.getDay()];
  return { date: trDateStr, day: trDayName };
}

function capitalizeTr(str) {
  if (!str) return "";
  return str.trim().split(/\s+/).map(word => {
    if (!word) return "";
    const firstChar = word.charAt(0).toLocaleUpperCase("tr-TR");
    const rest = word.slice(1).toLocaleLowerCase("tr-TR");
    return firstChar + rest;
  }).join(" ");
}

function parseCustomDate(input) {
  if (!input) return getTurkeyTimeInfo();
  const clean = input.trim().toLowerCase();

  if (clean === "bugün" || clean === "bugun" || clean === "today" || clean === "aynı" || clean === "ayni") {
    return getTurkeyTimeInfo(0);
  }
  if (clean === "dün" || clean === "dun" || clean === "yesterday") {
    return getTurkeyTimeInfo(-1);
  }
  if (clean === "evvelsi gün" || clean === "önceki gün" || clean === "onraki gun") {
    return getTurkeyTimeInfo(-2);
  }

  const trDays = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  // 1. ISO Formatı: YYYY-MM-DD (Örn: 2026-10-22)
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dObj = new Date(year, month - 1, day, 12, 0, 0);
    return { date: dateStr, day: trDays[dObj.getDay()] };
  }

  // 2. Türk Tarih Formatı: DD.MM.YYYY veya DD-MM-YYYY (Örn: 22.10.2026)
  const trNumMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (trNumMatch) {
    const day = parseInt(trNumMatch[1], 10);
    const month = parseInt(trNumMatch[2], 10);
    const year = parseInt(trNumMatch[3], 10);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dObj = new Date(year, month - 1, day, 12, 0, 0);
    return { date: dateStr, day: trDays[dObj.getDay()] };
  }

  // 3. Gün İsimleri (Örn: "salı", "çarşamba")
  const dayNamesTr = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"];
  const foundDayIndex = dayNamesTr.findIndex(d => clean.includes(d));
  if (foundDayIndex !== -1) {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const currentDayIndex = today.getDay();
    let diff = foundDayIndex - currentDayIndex;
    if (diff > 0) diff -= 7;
    return getTurkeyTimeInfo(diff);
  }

  // 4. Ay İsmiyle Tarih (Örn: "22 ekim", "22 ekim 2026")
  const monthNames = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
  const parts = clean.split(/[\s.-]+/);
  if (parts.length >= 2) {
    const dayNum = parseInt(parts[0], 10);
    const monthPart = parts[1];
    let monthNum = monthNames.findIndex(m => monthPart.includes(m));
    if (monthNum === -1 && !isNaN(parseInt(monthPart, 10))) {
      monthNum = parseInt(monthPart, 10) - 1;
    }
    const year = parts[2] ? parseInt(parts[2], 10) : 2026;

    if (!isNaN(dayNum) && monthNum >= 0 && monthNum <= 11) {
      const monthStr = String(monthNum + 1).padStart(2, "0");
      const dayStr = String(dayNum).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dObj = new Date(year, monthNum, dayNum, 12, 0, 0);
      return { date: dateStr, day: trDays[dObj.getDay()] };
    }
  }

  return getTurkeyTimeInfo(0);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Can Ne Yedi Telegram Bot Webhook Active! 🍔", { status: 200 });
    }

    try {
      const update = await request.json();

      if (update.update_id && processedUpdateIds.has(update.update_id)) {
        return new Response("OK", { status: 200 });
      }
      if (update.update_id) {
        processedUpdateIds.add(update.update_id);
        if (processedUpdateIds.size > 200) {
          const first = processedUpdateIds.values().next().value;
          processedUpdateIds.delete(first);
        }
      }

      // Inline Query Desteği
      if (update.inline_query) {
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(handleInlineQuery(update.inline_query, env));
        } else {
          await handleInlineQuery(update.inline_query, env);
        }
        return new Response("OK", { status: 200 });
      }

      // Callback Query Desteği (Profil butonları vb.)
      if (update.callback_query) {
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(handleCallbackQuery(update.callback_query, env));
        } else {
          await handleCallbackQuery(update.callback_query, env);
        }
        return new Response("OK", { status: 200 });
      }

      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(handleIncomingUpdate(update, env));
      } else {
        await handleIncomingUpdate(update, env);
      }

      return new Response("OK", { status: 200 });
    } catch (e) {
      console.error("Webhook fetch error:", e);
      return new Response("OK", { status: 200 });
    }
  }
};

async function handleIncomingUpdate(update, env) {
  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  let userText = update.message.text.trim().replace(/^@[\w_]+bot\s*/i, "").trim();
  const replyToText = update.message.reply_to_message ? update.message.reply_to_message.text : "";

  try {
    // 🔒 Yetki Kontrolü
    const fromUsername = update.message.from && update.message.from.username
      ? update.message.from.username.toLowerCase().replace("@", "")
      : "";

    const isAuthorized = ALLOWED_USERNAMES.includes(fromUsername) ||
      (env.ALLOWED_CHAT_ID && String(chatId) === String(env.ALLOWED_CHAT_ID));

    if (!isAuthorized) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⛔ Üzgünüm, bu bot sadece yetkili kullanıcılar (@emirarkali, @fifonee ve @kemalkyy) tarafından kullanılabilir.");
      return;
    }

    // Aktif Profil
    const activeProfile = getActiveProfile(chatId, fromUsername);

    // /iptal veya vazgeç
    const cancelText = userText.toLowerCase().replace(/İ/g, "i").replace(/I/g, "ı").replace(/^\//, "").trim();
    if (["iptal", "vazgec", "vazgeç", "cancel", "stop"].includes(cancelText)) {
      userSessions.delete(chatId);
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🚫 İşlem iptal edildi.");
      return;
    }

    const session = userSessions.get(chatId);

    // ============================================================
    // A0) DOĞAL DİLDE EKSİK BİLGİ TAMAMLAMA (Gemini Takip Sorusu)
    // ============================================================
    const isPendingNL = (session && session.action === "pending_nl") || replyToText.includes("NL_PENDING:");
    if (isPendingNL && !userText.startsWith("/")) {
      let pendingData = session ? session.pendingData : null;
      if (!pendingData) {
        const rawB64 = extractTag(replyToText, "NL_PENDING");
        if (rawB64) {
          try {
            pendingData = JSON.parse(decodeURIComponent(escape(atob(rawB64))));
          } catch (e) { }
        }
      }

      if (pendingData) {
        const liveMsg = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⏳ Bilgiler tamamlanıyor...`);
        const liveMsgId = liveMsg ? liveMsg.message_id : null;

        let parsedData = null;
        try {
          parsedData = await parseMealWithGeminiFast(userText, env.GEMINI_API_KEY, pendingData);
        } catch (aiErr) {
          await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId, `⚠️ Yapay zeka şu an meşgul.\nÖğünü tamamlamak için tekrar yazabilir veya **/ekle** kullanabilirsin.`);
          return;
        }

        if (parsedData.isComplete) {
          userSessions.delete(chatId);
          parsedData.meal.title = capitalizeTr(parsedData.meal.title);
          parsedData.meal.location = normalizeLocation(parsedData.meal.location);
          if (parsedData.meal.price) {
            parsedData.meal.price = formatPrice(parsedData.meal.price);
          }

          await saveNewMealToGitHub(env.GITHUB_TOKEN, parsedData.meal, parsedData.date, parsedData.day, activeProfile);

          const mealItems = parsedData.meal.items || [parsedData.meal.title];
          const aiFood = mealItems[0] || parsedData.meal.title;
          const aiDrink = mealItems.length > 1 ? mealItems.slice(1).join(" + ") : "";
          const foodLine = `${guessEmoji(aiFood)} *Yemek:* ${aiFood}`;
          const drinkLine = aiDrink ? `🥤 *İçecek:* ${aiDrink}` : "🥤 *İçecek:* (İçilmedi)";
          const noteLine = parsedData.meal.note ? `💬 *Not:* ${parsedData.meal.note}\n` : "";
          const finalSuccessMsg =
            `✅ *Harika, ${activeProfile.name}'ın günlüğüne eklendi!* (${activeProfile.emoji})\n\n` +
            `📅 *Tarih:* ${parsedData.day} (${parsedData.date})\n` +
            `${foodLine}\n` +
            `${drinkLine}\n` +
            `📍 *Konum:* ${parsedData.meal.location}\n` +
            `💰 *Fiyat:* ${parsedData.meal.price || "Belirtilmedi"}\n` +
            `${noteLine}\n` +
            `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${activeProfile.id}`;

          await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId, finalSuccessMsg);
          return;
        } else {
          // Hâlâ eksik alan var
          userSessions.set(chatId, { action: "pending_nl", pendingData: parsedData });
          let encoded = "";
          try {
            encoded = btoa(unescape(encodeURIComponent(JSON.stringify(parsedData))));
          } catch (e) { }

          if (liveMsgId) {
            await deleteTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId);
          }
          const followUpMsg = `${parsedData.question}\n\n[NL_PENDING:${encoded}]\n💡 _Vazgeçmek için /iptal yazabilirsin._`;
          await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, followUpMsg, "Cevabın...");
          return;
        }
      }
    }

    // ============================================================
    // A) /duzenle - ADIM 2: KULLANICI DÜZENLENMİŞ METNİ GÖNDERDİĞİNDE
    // ============================================================
    const isTemplateSubmission =
      (session && session.action === "duzenle_submit") ||
      replyToText.toLowerCase().includes("düzenleme") ||
      replyToText.toLowerCase().includes("duzenleme") ||
      userText.toLowerCase().includes("yemek:") ||
      (userText.toLowerCase().includes("fiyat:") && userText.toLowerCase().includes("tarih:")) ||
      userText.toLowerCase().startsWith("no:");

    if (isTemplateSubmission) {
      const lines = userText.split(/[\n|]+/).map(l => l.trim()).filter(l => l.length > 0);

      let parsedNum = null;
      let food = "";
      let drink = "";
      let loc = "Yurt";
      let price = "";
      let customDate = "";
      let note = "";

      // Satırları tek tek regex ile analiz et (Türkçe İ / i karakter uyumlu)
      for (const line of lines) {
        const noMatch = line.match(/^(?:no|#)\s*:?\s*(\d+)/i);
        const foodMatch = line.match(/^yemek\s*:\s*(.*)/i);
        const drinkMatch = line.match(/^[iI\u0130\u0131\u0069\u0049][\u0307]?[çc]ecek\s*:\s*(.*)/i);
        const locMatch = line.match(/^(?:konum|mekan)\s*:\s*(.*)/i);
        const priceMatch = line.match(/^fiyat\s*:\s*(.*)/i);
        const dateMatch = line.match(/^tarih\s*:\s*(.*)/i);
        const noteMatch = line.match(/^not\s*:\s*(.*)/i);

        if (noMatch) {
          parsedNum = parseInt(noMatch[1], 10);
        } else if (foodMatch) {
          food = foodMatch[1].trim();
        } else if (drinkMatch) {
          drink = drinkMatch[1].trim();
        } else if (locMatch) {
          loc = locMatch[1].trim();
        } else if (priceMatch) {
          price = priceMatch[1].trim();
        } else if (dateMatch) {
          customDate = dateMatch[1].trim();
        } else if (noteMatch) {
          const n = noteMatch[1].trim();
          note = isNoNote(n) ? "" : n;
        }
      }

      // Numarayı belirle
      const mealNum = parsedNum ||
        (session && session.mealNum) ||
        parseInt(extractTag(replyToText, "NO"), 10);

      const originalDate = customDate ||
        (session && session.originalDate) ||
        extractTag(replyToText, "ORIG_DATE");

      // Temizlikler
      if (isNoFood(food)) food = "";
      else food = capitalizeTr(food);

      if (isNoDrink(drink)) drink = "";
      else drink = capitalizeTr(drink);

      loc = normalizeLocation(loc);
      price = formatPrice(price);

      if (!mealNum || isNaN(mealNum)) {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "⚠️ Düzenlenecek öğün numarası belirlenemedi.\n\n" +
          "Lütfen şablonun en üst satırına numarasını ekleyip tekrar gönderin, örn:\n" +
          "`No: 3`\n`Yemek: ...`\n\n" +
          "Veya baştan seçmek için: /duzenle"
        );
        return;
      }

      if (!food && !drink) {
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Yemek veya içecekten en az birini yazmalısın. Lütfen tekrar düzenleyip gönderin:\n\n[DÜZENLEME ŞABLONU]");
        return;
      }

      if (!price) {
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Fiyat zorunludur! Lütfen fiyat satırını da doldurarak gönderin (Örn: Fiyat: 240 TL):\n\n[DÜZENLEME ŞABLONU]");
        return;
      }

      const dateInfo = parseCustomDate(customDate || originalDate);
      userSessions.delete(chatId);

      const statusMsg = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ Düzenleme siteye kaydediliyor...");
      const statusMsgId = statusMsg ? statusMsg.message_id : null;

      let fullTitle = food;
      let items = [food];
      if (food && drink) {
        fullTitle = `${food} + ${drink}`;
        items = [food, drink];
      } else if (!food && drink) {
        fullTitle = drink;
        items = [drink];
      }
      const primaryItem = food || drink;

      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (mealNum < 1 || mealNum > flatMeals.length) {
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusMsgId, `⚠️ Listede ${flatMeals.length} öğün var, #${mealNum} bulunamadı.`);
        return;
      }

      const oldItem = flatMeals[mealNum - 1];

      // Eski günden çıkar
      const oldDayEntry = mealsList.find(d => d.date === oldItem.date);
      if (oldDayEntry) {
        oldDayEntry.meals = oldDayEntry.meals.filter(m => m.id !== oldItem.meal.id);
        if (oldDayEntry.meals.length === 0) {
          mealsList = mealsList.filter(d => d.date !== oldItem.date);
        }
      }

      // Yeni güne ekle
      const updatedMeal = {
        id: `${dateInfo.date}-${Date.now().toString().slice(-4)}`,
        title: fullTitle,
        items: items,
        location: loc,
        price: price,
        emoji: guessEmoji(primaryItem),
        category: guessCategory(primaryItem),
        note: note
      };

      let targetDayEntry = mealsList.find(d => d.date === dateInfo.date);
      if (targetDayEntry) {
        targetDayEntry.meals.push(updatedMeal);
      } else {
        mealsList.push({
          date: dateInfo.date,
          day: dateInfo.day,
          meals: [updatedMeal]
        });
      }

      mealsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      await updateGitHubFile(
        env.GITHUB_TOKEN,
        githubFile.sha,
        JSON.stringify(mealsList, null, 2),
        `fix(${activeProfile.id}): düzenlendi #${mealNum} (${fullTitle} - ${price})`,
        activeProfile.filePath
      );

      // Can profili ise data/meals.json senkronize et
      if (activeProfile.id === "can") {
        try {
          const syncFile = await getGitHubFile(env.GITHUB_TOKEN, "data/meals.json");
          await updateGitHubFile(env.GITHUB_TOKEN, syncFile.sha, JSON.stringify(mealsList, null, 2), `sync: meals.json`, "data/meals.json");
        } catch (e) { }
      }

      const foodLine = food ? `${guessEmoji(food)} *Yemek:* ${food}` : "";
      const drinkLine = drink ? `🥤 *İçecek:* ${drink}` : "🥤 *İçecek:* (İçilmedi)";
      const noteLine = note ? `💬 *Not:* ${note}\n` : "";
      const okText =
        `✅ *#${mealNum} Numaralı Öğün Güncellendi!* (${activeProfile.emoji} ${activeProfile.name})\n\n` +
        `📅 *Tarih:* ${dateInfo.day} (${dateInfo.date})\n` +
        `${foodLine ? foodLine + "\n" : ""}` +
        `${drinkLine}\n` +
        `📍 *Konum:* ${loc}\n` +
        `💰 *Fiyat:* ${price}\n` +
        `${noteLine}\n` +
        `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${activeProfile.id}`;
      await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusMsgId, okText);
      return;
    }

    // ============================================================
    // B) /duzenle - ADIM 1: KULLANICI NUMARAYI SEÇTİĞİNDE
    // ============================================================
    if (session && session.action === "duzenle_select_num") {
      const numMatch = userText.match(/\d+/);
      const targetNum = numMatch ? parseInt(numMatch[0], 10) : NaN;
      if (isNaN(targetNum) || targetNum < 1) {
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Lütfen düzenlemek istediğin öğünün sadece numarasını yaz (Örn: 1):", "Örn: 1");
        return;
      }

      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (targetNum > flatMeals.length) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ Geçersiz numara! ${activeProfile.name} listesinde ${flatMeals.length} öğün var.`);
        return;
      }

      const item = flatMeals[targetNum - 1];
      let existingFood = item.meal.title;
      let existingDrink = "içmedim";
      if (item.meal.items && item.meal.items.length >= 2) {
        existingFood = item.meal.items[0].trim();
        existingDrink = item.meal.items.slice(1).join(" + ").trim();
      } else if (item.meal.title.includes("+")) {
        const split = item.meal.title.split("+");
        existingFood = split[0].trim();
        existingDrink = split.slice(1).join("+").trim();
      }

      // Kullanıcının oturumunu güncelle: artık şablonu bekliyoruz
      userSessions.set(chatId, {
        action: "duzenle_submit",
        mealNum: targetNum,
        originalDate: item.date
      });

      // Tek dokunuşla kopyalanabilir hazır şablon
      const existingPrice = item.meal.price || "";
      const existingNote = item.meal.note || "";
      const templateText =
        `No: ${targetNum}\n` +
        `Yemek: ${existingFood}\n` +
        `İçecek: ${existingDrink}\n` +
        `Konum: ${item.meal.location}\n` +
        `Fiyat: ${existingPrice}\n` +
        `Tarih: ${item.date}\n` +
        `Not: ${existingNote}`;

      const inlineQueryText = "\n" + templateText;

      const promptMsg =
        `✏️ *#${targetNum} Numaralı Öğün Seçildi!* (${activeProfile.emoji} ${activeProfile.name})\n\n` +
        `Aşağıdaki gri kutucuğa **tek dokunarak kopyalayabilir** veya alttaki **"✏️ Mesaj Kutusuna Doldur"** butonuna basabilirsin:\n\n` +
        `\`\`\`\n${templateText}\n\`\`\`\n\n` +
        `💡 İçecek veya not yoksa boş bırakabilir veya "yok" yazabilirsin. İptal için: iptal`;

      await sendInlineButtonMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        promptMsg,
        [
          [
            {
              text: "✏️ Mesaj Kutusuna Doldur",
              switch_inline_query_current_chat: inlineQueryText
            }
          ]
        ]
      );
      return;
    }

    // ============================================================
    // 0. /sil BEKLEME MODU
    // ============================================================
    if ((session && session.action === "sil") || replyToText.includes("[SİLME MODU]")) {
      const numMatch = userText.match(/\d+/);
      const targetNum = numMatch ? parseInt(numMatch[0], 10) : NaN;
      if (isNaN(targetNum) || targetNum < 1) {
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Lütfen silmek istediğin öğünün sadece numarasını yaz (Örn: 1):\n\n[SİLME MODU]", "Örn: 1");
        return;
      }

      userSessions.delete(chatId);

      const statusMsg = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ Öğün siteden siliniyor...");
      const statusMsgId = statusMsg ? statusMsg.message_id : null;

      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (targetNum > flatMeals.length) {
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusMsgId, `⚠️ Geçersiz numara! Listede toplam ${flatMeals.length} öğün var.`);
        return;
      }

      const itemToDelete = flatMeals[targetNum - 1];
      const dayEntry = mealsList.find(d => d.date === itemToDelete.date);
      if (dayEntry) {
        dayEntry.meals = dayEntry.meals.filter(m => m.id !== itemToDelete.meal.id);
        if (dayEntry.meals.length === 0) {
          mealsList = mealsList.filter(d => d.date !== itemToDelete.date);
        }
      }

      await updateGitHubFile(
        env.GITHUB_TOKEN,
        githubFile.sha,
        JSON.stringify(mealsList, null, 2),
        `chore(${activeProfile.id}): silindi #${targetNum}`,
        activeProfile.filePath
      );

      // Can profili ise data/meals.json senkronize et
      if (activeProfile.id === "can") {
        try {
          const syncFile = await getGitHubFile(env.GITHUB_TOKEN, "data/meals.json");
          await updateGitHubFile(env.GITHUB_TOKEN, syncFile.sha, JSON.stringify(mealsList, null, 2), `sync: meals.json`, "data/meals.json");
        } catch (e) { }
      }

      await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusMsgId, `🗑️ *Öğün Silindi!*\n\n*${itemToDelete.meal.title}* ${activeProfile.name}'ın günlüğünden kaldırıldı.`);
      return;
    }

    // ============================================================
    // 1. /ekle ADIMLARI
    // ============================================================
    if ((session && session.action === "ekle") || replyToText.includes("[EKLE-ADIM")) {
      let step = session ? session.step : 1;
      if (replyToText.includes("[EKLE-ADIM 1]")) step = 1;
      if (replyToText.includes("[EKLE-ADIM 2]")) step = 2;
      if (replyToText.includes("[EKLE-ADIM 3]")) step = 3;
      if (replyToText.includes("[EKLE-ADIM 4]")) step = 4;
      if (replyToText.includes("[EKLE-ADIM 5]")) step = 5;
      if (replyToText.includes("[EKLE-ADIM 6]")) step = 6;

      if (step === 1) {
        const dateInfo = parseCustomDate(userText);
        userSessions.set(chatId, { action: "ekle", step: 2, dateInfo });

        const q2 =
          `➕ [EKLE-ADIM 2]\n` +
          `[DATE:${dateInfo.date}|${dateInfo.day}]\n\n` +
          `📅 Seçilen Gün: *${dateInfo.day} (${dateInfo.date})*\n\n` +
          `2️⃣ *Ne yedin? (Yemek)*\n` +
          `_(Örn: Hamburger, Çiğ Köfte, Pizza)_\n\n` +
          `💡 Eğer yemek yemediysen *yemedim* yaz.`;
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, q2, "Örn: Hamburger veya yemedim");
        return;
      }

      if (step === 2) {
        const dateInfo = (session && session.dateInfo) || parseCustomDate(extractTag(replyToText, "DATE"));
        const food = isNoFood(userText) ? "" : capitalizeTr(userText);
        userSessions.set(chatId, { action: "ekle", step: 3, dateInfo, food });

        const q3 =
          `➕ [EKLE-ADIM 3]\n` +
          `[DATE:${dateInfo.date}|${dateInfo.day}] [FOOD:${food}]\n\n` +
          `3️⃣ *Yanında ne içtin? (İçecek)*\n` +
          `_(Örn: Şalgam, Ayran, Kola, Fuse Tea)_\n\n` +
          `💡 Eğer içmediysen *içmedim* yaz.`;
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, q3, "Örn: Şalgam veya içmedim");
        return;
      }

      if (step === 3) {
        const dateInfo = (session && session.dateInfo) || parseCustomDate(extractTag(replyToText, "DATE"));
        const food = (session && session.food !== undefined) ? session.food : extractTag(replyToText, "FOOD");
        const drink = isNoDrink(userText) ? "" : capitalizeTr(userText);

        if (!food && !drink) {
          userSessions.delete(chatId);
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Hem yemek yemedim hem içecek içmedim dedin, kaydedilecek bir şey yok! İşlem iptal edildi.");
          return;
        }

        userSessions.set(chatId, { action: "ekle", step: 4, dateInfo, food, drink });

        const q4 =
          `➕ [EKLE-ADIM 4]\n` +
          `[DATE:${dateInfo.date}|${dateInfo.day}] [FOOD:${food}] [DRINK:${drink}]\n\n` +
          `4️⃣ *Nerede yedin / Konum neresi?*\n` +
          `_(Örn: Yurt, Jungle Burger, McDonald's)_`;
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, q4, "Örn: Yurt");
        return;
      }

      if (step === 4) {
        const dateInfo = (session && session.dateInfo) || parseCustomDate(extractTag(replyToText, "DATE"));
        const food = (session && session.food !== undefined) ? session.food : extractTag(replyToText, "FOOD");
        const drink = (session && session.drink !== undefined) ? session.drink : extractTag(replyToText, "DRINK");
        const loc = normalizeLocation(userText);
        userSessions.set(chatId, { action: "ekle", step: 5, dateInfo, food, drink, loc });

        const q5 =
          `➕ [EKLE-ADIM 5]\n` +
          `[DATE:${dateInfo.date}|${dateInfo.day}] [FOOD:${food}] [DRINK:${drink}] [LOC:${loc}]\n\n` +
          `5️⃣ *Fiyatı ne kadar tuttu?*\n` +
          `_(Örn: 140 TL)_`;
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, q5, "Örn: 140 TL");
        return;
      }

      if (step === 5) {
        const dateInfo = (session && session.dateInfo) || parseCustomDate(extractTag(replyToText, "DATE"));
        const food = (session && session.food !== undefined) ? session.food : extractTag(replyToText, "FOOD");
        const drink = (session && session.drink !== undefined) ? session.drink : extractTag(replyToText, "DRINK");
        const loc = (session && session.loc) || extractTag(replyToText, "LOC");
        const price = formatPrice(userText);

        if (!price) {
          await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ Lütfen geçerli bir fiyat yazın (Örn: 140 TL):`, "Örn: 140 TL");
          return;
        }

        userSessions.set(chatId, { action: "ekle", step: 6, dateInfo, food, drink, loc, price });

        const q6 =
          `➕ [EKLE-ADIM 6]\n` +
          `[DATE:${dateInfo.date}|${dateInfo.day}] [FOOD:${food}] [DRINK:${drink}] [LOC:${loc}] [PRICE:${price}]\n\n` +
          `6️⃣ *Öğün için bir not / açıklama eklemek ister misin? (Opsiyonel)*\n` +
          `_(Örn: 'Patatesleri sıcaktı', 'Arkadaşlarla yedik')_\n\n` +
          `💡 Not eklemek istemiyorsan *yok* veya *geç* yazıp geçebilirsin.`;
        await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, q6, "Örn: yok veya notun...");
        return;
      }

      if (step === 6) {
        const dateInfo = (session && session.dateInfo) || parseCustomDate(extractTag(replyToText, "DATE"));
        const food = (session && session.food !== undefined) ? session.food : extractTag(replyToText, "FOOD");
        const drink = (session && session.drink !== undefined) ? session.drink : extractTag(replyToText, "DRINK");
        const loc = (session && session.loc) || extractTag(replyToText, "LOC");
        const price = (session && session.price) || extractTag(replyToText, "PRICE");
        const note = isNoNote(userText) ? "" : userText.trim();

        userSessions.delete(chatId);

        const statusMsg = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ Siteye kaydediliyor...");
        const statusMsgId = statusMsg ? statusMsg.message_id : null;

        let fullTitle = food;
        let items = [food];
        if (food && drink) {
          fullTitle = `${food} + ${drink}`;
          items = [food, drink];
        } else if (!food && drink) {
          fullTitle = drink;
          items = [drink];
        }
        const primaryItem = food || drink;

        await saveNewMealToGitHub(env.GITHUB_TOKEN, {
          title: fullTitle,
          items: items,
          location: loc,
          price: price,
          category: guessCategory(primaryItem),
          emoji: guessEmoji(primaryItem),
          note: note
        }, dateInfo.date, dateInfo.day, activeProfile);

        const foodLine = food ? `${guessEmoji(food)} *Yemek:* ${food}` : "";
        const drinkLine = drink ? `🥤 *İçecek:* ${drink}` : "🥤 *İçecek:* (İçilmedi)";
        const noteLine = note ? `💬 *Not:* ${note}\n` : "";
        const okText =
          `✅ *Siteye Eklendi!* (${activeProfile.emoji} ${activeProfile.name})\n\n` +
          `📅 *Tarih:* ${dateInfo.day} (${dateInfo.date})\n` +
          `${foodLine ? foodLine + "\n" : ""}` +
          `${drinkLine}\n` +
          `📍 *Konum:* ${loc}\n` +
          `💰 *Fiyat:* ${price}\n` +
          `${noteLine}\n` +
          `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${activeProfile.id}`;
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, statusMsgId, okText);
        return;
      }
    }

    // ============================================================
    // 3. ANA KOMUTLAR (Başına / koymak zorunlu DEĞİLDİR!)
    // ============================================================
    const rawClean = userText
      .replace(/İ/g, "i")
      .replace(/I/g, "ı")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^\//, "")
      .trim();
    const cmdParts = rawClean.split(/\s+/).filter(Boolean);
    const cmdWord = (cmdParts[0] || "").replace(/[.,:;!?]+$/, "");

    const PROFIL_ALIASES = [
      "profil", "profile", "kullanici", "hesap", "sec", "degistir", "kimim"
    ];
    const DUZENLE_ALIASES = [
      "duzenle", "duzen", "guncelle", "guncelleme", "duzelt", "duzeltme",
      "degistir", "degistirme", "edit", "update", "modify"
    ];
    const SIL_ALIASES = [
      "sil", "silme", "kaldir", "delete", "remove", "cikar"
    ];
    const EKLE_ALIASES = [
      "ekle", "ekleme", "yeni", "add", "kaydet", "kayit", "yaz"
    ];
    const LISTE_ALIASES = [
      "liste", "listele", "list", "ogunler", "yemekler", "son"
    ];
    const YARDIM_ALIASES = [
      "start", "yardim", "help", "komutlar", "menu"
    ];

    // /start ve /yardim
    if (YARDIM_ALIASES.includes(cmdWord)) {
      const helpMsg =
        `🍽️ *Kim Ne Yedi? Yönetim Asistanı*\n` +
        `👤 *Aktif Profil:* ${activeProfile.emoji} *${activeProfile.name}*\n\n` +
        `📌 *Komutlar (ister / ile ister doğrudan yaz):*\n` +
        `• \`profil\` : Aktif profili gösterir ve değiştirir (Can, Emir, Kemal)\n` +
        `• \`ekle\` : Adım adım sorarak yeni öğün ekler.\n` +
        `• \`duzenle\` / \`guncelle\` : Listeyi açar veya \`guncelle 3\` yazarak doğrudan şablonu alabilirsin!\n` +
        `• \`liste\` : Seçili profilin son öğünlerini gösterir.\n` +
        `• \`sil\` : Listeyi açar ve numarasını sorarak sildirir (veya \`sil 2\`).\n` +
        `• \`iptal\` : Devam eden işlemi iptal eder.\n\n` +
        `🤖 *Doğal Dil ile Hızlı Ekleme:*\n` +
        `• \`McDonald'sda hamburger menü yedim 230 tl yanında fuse tea şeftali\`\n\n` +
        `🌐 *Canlı Site:* https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${activeProfile.id}`;
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, helpMsg, "Markdown");
      return;
    }

    // /profil veya profil <isim>
    if (PROFIL_ALIASES.includes(cmdWord)) {
      const targetParam = cmdParts[1] ? cmdParts[1].toLowerCase().replace("@", "") : null;
      if (targetParam) {
        const foundProf = Object.values(USER_PROFILES).find(p =>
          p.id.toLowerCase() === targetParam ||
          p.name.toLowerCase() === targetParam ||
          p.telegramUsernames.some(u => u.toLowerCase() === targetParam)
        );

        if (foundProf) {
          userActiveProfiles.set(chatId, foundProf.id);
          const switchSuccess =
            `✅ *Aktif Profil Değiştirildi:* ${foundProf.emoji} *${foundProf.name}*\n\n` +
            `Artık ekleyeceğin, listeleyeceğin veya düzenleyeceğin tüm öğünler *${foundProf.name}* adına kaydedilecek.\n` +
            `📁 Dosya: \`${foundProf.filePath}\`\n\n` +
            `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${foundProf.id}`;
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, switchSuccess, "Markdown");
          return;
        } else {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `⚠️ '*${targetParam}*' adında bir profil bulunamadı.\n\n` +
            `Kullanılabilir profiller:\n` +
            `• \`profil can\` (🍔 Can)\n` +
            `• \`profil emir\` (🌯 Emir)\n` +
            `• \`profil kemal\` (🍕 Kemal)`
          );
          return;
        }
      }

      // Argümansız /profil
      const profileButtons = [
        [
          { text: "🍔 Can", callback_data: "set_profile:can" },
          { text: "🌯 Emir", callback_data: "set_profile:emir" },
          { text: "🍕 Kemal", callback_data: "set_profile:kemal" }
        ]
      ];

      const currentMsg =
        `👤 *Mevcut Aktif Profil:* ${activeProfile.emoji} *${activeProfile.name}*\n` +
        `📁 Hedef Dosya: \`${activeProfile.filePath}\`\n\n` +
        `🔄 *Profil Değiştirmek İçin Butona Bas veya Yaz:*\n` +
        `• \`profil can\` ➔ 🍔 Can\n` +
        `• \`profil emir\` ➔ 🌯 Emir\n` +
        `• \`profil kemal\` ➔ 🍕 Kemal\n\n` +
        `💡 *İpucu:* Yemek eklerken doğrudan o anki aktif profilin günlüğüne işlenir.`;

      await sendInlineButtonMessage(env.TELEGRAM_BOT_TOKEN, chatId, currentMsg, profileButtons);
      return;
    }

    // /ekle
    if (EKLE_ALIASES.includes(cmdWord) && cmdParts.length <= 2) {
      userSessions.set(chatId, { action: "ekle", step: 1 });
      const { date: todayDate, day: todayDay } = getTurkeyTimeInfo();
      const step1Msg =
        `➕ [EKLE-ADIM 1] (${activeProfile.emoji} ${activeProfile.name})\n\n` +
        `1️⃣ *Hangi gün için ekliyorsun?*\n` +
        `_(Örn: 'bugün', 'dün', '21 Ekim' veya 'Salı')_\n\n` +
        `💡 Bugün için doğrudan *bugün* yazabilirsin (${todayDay}).`;
      await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, step1Msg, "Örn: bugün veya dün");
      return;
    }

    // /liste
    if (LISTE_ALIASES.includes(cmdWord) && cmdParts.length <= 2) {
      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (flatMeals.length === 0) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📭 ${activeProfile.name} (${activeProfile.emoji}) için henüz kayıtlı öğün bulunmuyor.`);
        return;
      }

      let listMsg = `📋 *Son Eklenen Öğünler (${activeProfile.emoji} ${activeProfile.name}):*\n\n`;
      flatMeals.slice(0, 8).forEach((item, index) => {
        const num = index + 1;
        const priceStr = item.meal.price ? ` - 💰 *${item.meal.price}*` : "";
        listMsg += `*#${num}* [${item.day}] ${item.meal.emoji || '🍽️'} *${item.meal.title}*\n`;
        listMsg += `   📍 ${item.meal.location}${priceStr}\n\n`;
      });

      listMsg += "💡 *İşlemler:*\n";
      listMsg += "• Düzenlemek için: `duzenle` veya `guncelle 1`\n";
      listMsg += "• Silmek için: `sil` veya `sil 1`\n";
      listMsg += "• Profil değiştirmek için: `profil`";

      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, listMsg, "Markdown");
      return;
    }

    // /duzenle /guncelle /duzelt (Argümanlı veya Argümansız)
    const isDuzenle = DUZENLE_ALIASES.includes(cmdWord) ||
      (cmdParts.length <= 4 && cmdParts.some(p => DUZENLE_ALIASES.includes(p.replace(/[.,:;!?]+$/, ""))));

    if (isDuzenle) {
      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (flatMeals.length === 0) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📭 ${activeProfile.name} için düzenlenecek kayıtlı öğün bulunmuyor.`);
        return;
      }

      // "güncelle 3", "duzenle 3", "3 güncelle", "#3 düzenle", "güncelle no 3" gibi numarayı yakala
      let targetNum = null;
      for (const part of cmdParts) {
        const m = part.match(/(?:#|no:?|\b)(\d+)\b/i) || part.match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > 0) {
            targetNum = n;
            break;
          }
        }
      }

      // Eğer kullanıcı numara belirttiyse o öğünün şablonunu doğrudan aç
      if (targetNum !== null) {
        if (targetNum > flatMeals.length || targetNum < 1) {
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ Geçersiz numara! Listede ${flatMeals.length} öğün var.`);
          return;
        }

        const item = flatMeals[targetNum - 1];
        let existingFood = item.meal.title;
        let existingDrink = "içmedim";
        if (item.meal.items && item.meal.items.length >= 2) {
          existingFood = item.meal.items[0].trim();
          existingDrink = item.meal.items.slice(1).join(" + ").trim();
        } else if (item.meal.title.includes("+")) {
          const split = item.meal.title.split("+");
          existingFood = split[0].trim();
          existingDrink = split.slice(1).join("+").trim();
        }

        userSessions.set(chatId, {
          action: "duzenle_submit",
          mealNum: targetNum,
          originalDate: item.date
        });

        const existingPrice = item.meal.price || "";
        const existingNote = item.meal.note || "";
        const templateText =
          `No: ${targetNum}\n` +
          `Yemek: ${existingFood}\n` +
          `İçecek: ${existingDrink}\n` +
          `Konum: ${item.meal.location}\n` +
          `Fiyat: ${existingPrice}\n` +
          `Tarih: ${item.date}\n` +
          `Not: ${existingNote}`;

        const inlineQueryText = "\n" + templateText;

        const promptMsg =
          `✏️ *#${targetNum} Numaralı Öğün Seçildi!*\n\n` +
          `Aşağıdaki gri kutucuğa **tek dokunarak kopyalayabilir** veya alttaki **"✏️ Mesaj Kutusuna Doldur"** butonuna basabilirsin:\n\n` +
          `\`\`\`\n${templateText}\n\`\`\`\n\n` +
          `💡 İçecek veya not yoksa boş bırakabilir veya "yok" yazabilirsin. İptal için: iptal`;

        await sendInlineButtonMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          promptMsg,
          [
            [
              {
                text: "✏️ Mesaj Kutusuna Doldur",
                switch_inline_query_current_chat: inlineQueryText
              }
            ]
          ]
        );
        return;
      }

      // Sadece "duzenle" / "guncelle" yazıldıysa: Listeyi göster ve numarayı sor
      userSessions.set(chatId, { action: "duzenle_select_num" });

      let listMsg = "✏️ [DÜZENLEME MODU]\n\n📋 *Mevcut Öğünler:*\n\n";
      flatMeals.slice(0, 8).forEach((item, index) => {
        const num = index + 1;
        const priceStr = item.meal.price ? ` - 💰 ${item.meal.price}` : "";
        let foodPart = item.meal.title;
        let drinkPart = "";
        if (item.meal.items && item.meal.items.length >= 2) {
          foodPart = item.meal.items[0];
          drinkPart = ` + 🥤 ${item.meal.items.slice(1).join(" + ")}`;
        } else if (item.meal.title.includes("+")) {
          const s = item.meal.title.split("+");
          foodPart = s[0].trim();
          drinkPart = ` + 🥤 ${s.slice(1).join("+").trim()}`;
        }
        listMsg += `*#${num}* [${item.day}] ${guessEmoji(foodPart)} *${foodPart}*${drinkPart} (${item.meal.location}${priceStr})\n`;
      });

      listMsg += "\n👉 *Hangi numaralı öğünü düzenlemek istiyorsun?*\n_(Sadece numarasını yaz, örn: 1 veya 3)_\n💡 Vazgeçmek için: /iptal";
      await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, listMsg, "Örn: 1");
      return;
    }

    // /sil (Argümansız veya argümanlı /sil)
    const isSil = SIL_ALIASES.includes(cmdWord) ||
      (cmdParts.length <= 4 && cmdParts.some(p => SIL_ALIASES.includes(p.replace(/[.,:;!?]+$/, ""))));

    if (isSil) {
      const githubFile = await getGitHubFile(env.GITHUB_TOKEN, activeProfile.filePath);
      let mealsList = [];
      try {
        mealsList = JSON.parse(githubFile.content);
      } catch (e) {
        mealsList = [];
      }
      const flatMeals = getFlattenedMeals(mealsList);

      if (flatMeals.length === 0) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📭 ${activeProfile.name} için silinecek kayıtlı öğün bulunmuyor.`);
        return;
      }

      let targetNum = null;
      for (const part of cmdParts) {
        const m = part.match(/(?:#|no:?|\b)(\d+)\b/i) || part.match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > 0) {
            targetNum = n;
            break;
          }
        }
      }

      if (targetNum !== null) {
        if (targetNum > flatMeals.length || targetNum < 1) {
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ Geçersiz numara! Toplam ${flatMeals.length} öğün var.`);
          return;
        }

        const itemToDelete = flatMeals[targetNum - 1];
        const dayEntry = mealsList.find(d => d.date === itemToDelete.date);
        if (dayEntry) {
          dayEntry.meals = dayEntry.meals.filter(m => m.id !== itemToDelete.meal.id);
          if (dayEntry.meals.length === 0) {
            mealsList = mealsList.filter(d => d.date !== itemToDelete.date);
          }
        }

        await updateGitHubFile(
          env.GITHUB_TOKEN,
          githubFile.sha,
          JSON.stringify(mealsList, null, 2),
          `chore(${activeProfile.id}): silindi #${targetNum}`,
          activeProfile.filePath
        );

        // Can profili ise data/meals.json senkronize et
        if (activeProfile.id === "can") {
          try {
            const syncFile = await getGitHubFile(env.GITHUB_TOKEN, "data/meals.json");
            await updateGitHubFile(env.GITHUB_TOKEN, syncFile.sha, JSON.stringify(mealsList, null, 2), `sync: meals.json`, "data/meals.json");
          } catch (e) { }
        }

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🗑️ *Öğün Silindi!*\n\n*${itemToDelete.meal.title}* ${activeProfile.name}'ın günlüğünden kaldırıldı.`);
        return;
      }

      userSessions.set(chatId, { action: "sil" });

      let listMsg = `🗑️ [SİLME MODU] (${activeProfile.emoji} ${activeProfile.name})\n\n📋 *Mevcut Öğünler:*\n\n`;
      flatMeals.slice(0, 8).forEach((item, index) => {
        const num = index + 1;
        const priceStr = item.meal.price ? ` - 💰 ${item.meal.price}` : "";
        let foodPart = item.meal.title;
        let drinkPart = "";
        if (item.meal.items && item.meal.items.length >= 2) {
          foodPart = item.meal.items[0];
          drinkPart = ` + 🥤 ${item.meal.items.slice(1).join(" + ")}`;
        } else if (item.meal.title.includes("+")) {
          const s = item.meal.title.split("+");
          foodPart = s[0].trim();
          drinkPart = ` + 🥤 ${s.slice(1).join("+").trim()}`;
        }
        listMsg += `*#${num}* [${item.day}] ${guessEmoji(foodPart)} *${foodPart}*${drinkPart} (${item.meal.location}${priceStr})\n`;
      });

      listMsg += "\n👉 *Hangi numaralı öğünü silmek istiyorsun?*\n_(Sadece numarasını yaz, örn: 1 veya 2)_\n💡 Vazgeçmek için /iptal yazabilirsin.";
      await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, listMsg, "Örn: 1");
      return;
    }

    // ============================================================
    // 4. Bilinmeyen Komut, Kısa Metin ve Şablon Kontrolü (Yapay Zekaya Gitmesini Engelle)
    // ============================================================
    if (userText.startsWith("/") || cmdParts.length === 1) {
      const unknownMsg =
        `❓ *Komut anlaşılamadı:* \`${userText}\`\n\n` +
        `👤 *Aktif Profil:* ${activeProfile.emoji} *${activeProfile.name}*\n\n` +
        `💡 *Kullanabileceğin komutlar (başına / koyman zorunlu DEĞİLDİR):*\n` +
        `• *profil* : Profili gösterir / değiştirir (Can, Emir, Kemal)\n` +
        `• *ekle* : Adım adım yeni öğün ekler\n` +
        `• *duzenle* / *guncelle* : Öğünleri listeler ve düzenletir (Örn: \`duzenle 3\` veya \`guncelle\`)\n` +
        `• *liste* : Son öğünleri gösterir\n` +
        `• *sil* : Öğün siler (Örn: \`sil 2\` veya \`sil\`)\n` +
        `• *iptal* : İşlemi iptal eder\n\n` +
        `_(Doğal dille yemek eklemek için ne yediğini ve fiyatını tam cümle olarak yazmalısın, örn: "Yurtta hamburger yedim 220 TL")_`;
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, unknownMsg, "Markdown");
      return;
    }

    // Gerçek bir form/şablon gibi birden fazla etiket (Yemek:, Fiyat:, Konum: vb.) içeren metinler
    const templateMatches = (userText.match(/(?:^|\n)\s*(?:yemek|i[çc]ecek|fiyat|konum|mekan|tarih|not)\s*:/gi) || []).length;
    if (templateMatches >= 2) {
      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "⚠️ Düzenleme şablonu algılandı fakat öğün numarası belirlenemedi.\n\n" +
        "Lütfen en üst satıra öğün numarasını yazarak gönderin, örn:\n" +
        "`No: 3`\n" +
        "`Yemek: ...`\n\n" +
        "Veya baştan seçmek için: **/duzenle**"
      );
      return;
    }

    // ============================================================
    // 5. Doğal Dil ile Ekleme (CANLI İLERLEME GÖSTERGELİ!)
    // ============================================================
    const liveMsg = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⏳ [1/2] ${activeProfile.name} için menü çözümleniyor...`);
    const liveMsgId = liveMsg ? liveMsg.message_id : null;

    let parsedData = null;
    try {
      parsedData = await parseMealWithGeminiFast(userText, env.GEMINI_API_KEY);
    } catch (aiErr) {
      await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId, `⚠️ Yapay zeka şu an meşgul.\nÖğünü hemen eklemek için **/ekle** yazabilirsin!`);
      return;
    }

    if (!parsedData.isComplete) {
      userSessions.set(chatId, { action: "pending_nl", pendingData: parsedData });
      let encoded = "";
      try {
        encoded = btoa(unescape(encodeURIComponent(JSON.stringify(parsedData))));
      } catch (e) { }

      if (liveMsgId) {
        await deleteTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId);
      }
      const askMsg = `${parsedData.question}\n\n[NL_PENDING:${encoded}]\n💡 _Vazgeçmek için /iptal yazabilirsin._`;
      await sendForceReplyMessage(env.TELEGRAM_BOT_TOKEN, chatId, askMsg, "Örn: 36 TL veya Yurt");
      return;
    }

    parsedData.meal.title = capitalizeTr(parsedData.meal.title);
    parsedData.meal.location = normalizeLocation(parsedData.meal.location);
    if (parsedData.meal.price) {
      parsedData.meal.price = formatPrice(parsedData.meal.price);
    }

    await editTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      liveMsgId,
      `📝 [2/2] *${parsedData.meal.title}* (${parsedData.meal.price}) anlaşıldı ➔ ${activeProfile.name}'ın günlüğüne kaydediliyor...`
    );

    await saveNewMealToGitHub(env.GITHUB_TOKEN, parsedData.meal, parsedData.date, parsedData.day, activeProfile);

    const mealItems = parsedData.meal.items || [parsedData.meal.title];
    const aiFood = mealItems[0] || parsedData.meal.title;
    const aiDrink = mealItems.length > 1 ? mealItems.slice(1).join(" + ") : "";
    const foodLine = `${guessEmoji(aiFood)} *Yemek:* ${aiFood}`;
    const drinkLine = aiDrink ? `🥤 *İçecek:* ${aiDrink}` : "🥤 *İçecek:* (İçilmedi)";
    const noteLine = parsedData.meal.note ? `💬 *Not:* ${parsedData.meal.note}\n` : "";
    const finalSuccessMsg =
      `✅ *Harika, ${activeProfile.name}'ın günlüğüne eklendi!* (${activeProfile.emoji})\n\n` +
      `📅 *Tarih:* ${parsedData.day} (${parsedData.date})\n` +
      `${foodLine}\n` +
      `${drinkLine}\n` +
      `📍 *Konum:* ${parsedData.meal.location}\n` +
      `💰 *Fiyat:* ${parsedData.meal.price}\n` +
      `${noteLine}\n` +
      `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${activeProfile.id}`;

    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, liveMsgId, finalSuccessMsg);

  } catch (error) {
    console.error("handleIncomingUpdate error:", error);
    if (chatId && env.TELEGRAM_BOT_TOKEN) {
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Hata: ${error.message}`);
    }
  }
}

// --- YARDIMCI FONKSİYONLAR ---

function isSame(text) {
  const t = text.trim().toLowerCase();
  return t === "aynı" || t === "ayni" || t === "aynisı" || t === "aynisi" || t === "same";
}

function isNoDrink(text) {
  if (!text) return true;
  const t = text.trim().toLocaleLowerCase("tr-TR");
  return (
    t === "içmedim" || t === "icmedim" || t === "içmedım" || t === "icmedım" ||
    t === "içmedm" || t === "yok" || t === "yoktu" || t === "hayır" || t === "hayir" ||
    t === "su" || t === "hiçbir şey" || t === "hicbir sey" || t === "-" || t === "null" || t === "undefined"
  );
}

function isNoFood(text) {
  if (!text) return true;
  const t = text.trim().toLowerCase();
  return (
    t === "yemedim" || t === "yemedım" || t === "yemedm" || t === "yok" ||
    t === "yoktu" || t === "hayır" || t === "hayir" || t === "hiçbir şey" ||
    t === "hicbir sey" || t === "-"
  );
}

function isNoNote(text) {
  if (!text) return true;
  const t = text.trim().toLocaleLowerCase("tr-TR");
  return (
    t === "yok" || t === "yoktu" || t === "geç" || t === "gec" ||
    t === "hayır" || t === "hayir" || t === "boş" || t === "bos" ||
    t === "-" || t === "istemiyorum" || t === "yoktur" || t === "none" ||
    t === "null" || t === "undefined"
  );
}

function extractTag(text, tag) {
  if (!text) return "";
  const match = text.match(new RegExp(`(?:\\[${tag}:|\\b${tag}:)(.*?)(?:\\]|\\s|$)`, "i"));
  return match ? match[1].trim() : "";
}

function normalizeLocation(loc) {
  if (!loc) return "Yurt";
  const l = loc.trim().toLowerCase();
  if (l.includes("yurt")) return "Yurt";
  if (l.includes("mc") || l.includes("donald")) return "McDonald's";
  if (l.includes("jungle")) return "Jungle Burger";
  if (l.includes("burger king")) return "Burger King";
  return capitalizeTr(loc);
}

function formatPrice(p) {
  if (!p) return null;
  const clean = p.trim();
  if (clean.includes("TL") || clean.includes("₺")) return clean;
  return `${clean} TL`;
}

function guessEmoji(title) {
  if (!title) return "🍽️";
  const l = title.toLowerCase();

  // Fast food & Ana Yemekler
  if (l.includes("burger") || l.includes("whopper") || l.includes("big mac")) return "🍔";
  if (l.includes("pizza")) return "🍕";
  if (l.includes("tost") || l.includes("sandviç") || l.includes("sandvic") || l.includes("kumru") || l.includes("ekmek arası")) return "🥪";
  if (l.includes("dürüm") || l.includes("durum") || l.includes("tantuni") || l.includes("çiğ köfte") || l.includes("cig kofte") || l.includes("wrap") || l.includes("zater")) return "🌯";
  if (l.includes("döner") || l.includes("doner") || l.includes("kebap") || l.includes("iskender")) return "🥙";
  if (l.includes("köfte") || l.includes("kofte")) return "🧆";
  if (l.includes("çorba") || l.includes("corba") || l.includes("mercimek") || l.includes("ezogelin") || l.includes("yayla") || l.includes("paça") || l.includes("paca")) return "🍲";
  if (l.includes("patates") || l.includes("fries") || l.includes("cips") || l.includes("chips")) return "🍟";
  if (l.includes("tavuk") || l.includes("nugget") || l.includes("şinitzel") || l.includes("sinitzel") || l.includes("kanat") || l.includes("wings") || l.includes("strips")) return "🍗";
  if (l.includes("makarna") || l.includes("pasta") || l.includes("spagetti") || l.includes("spaghetti") || l.includes("noodle") || l.includes("mantı") || l.includes("manti")) return "🍝";
  if (l.includes("pilav") || l.includes("pirinç")) return "🍚";
  if (l.includes("lahmacun") || l.includes("pide")) return "🫓";
  if (l.includes("börek") || l.includes("borek") || l.includes("poğaça") || l.includes("pogaca") || l.includes("simit") || l.includes("boyoz") || l.includes("açma")) return "🥐";
  if (l.includes("kahvaltı") || l.includes("kahvalti") || l.includes("menemen") || l.includes("yumurta") || l.includes("omlet")) return "🍳";
  if (l.includes("salata") || l.includes("salad") || l.includes("bowl")) return "🥗";
  if (l.includes("balık") || l.includes("balik") || l.includes("sushi") || l.includes("ton balık")) return "🐟";
  if (l.includes("waffle") || l.includes("pankek") || l.includes("pancake") || l.includes("krep")) return "🧇";
  if (l.includes("tatlı") || l.includes("tatli") || l.includes("pasta") || l.includes("cheesecake") || l.includes("brownie") || l.includes("kek") || l.includes("sufle")) return "🍰";
  if (l.includes("dondurma")) return "🍦";

  // İçecekler
  if (l.includes("ayran") || l.includes("süt") || l.includes("sut")) return "🥛";
  if (l.includes("kahve") || l.includes("latte") || l.includes("espresso") || l.includes("cappuccino") || l.includes("americano") || l.includes("mocha") || l.includes("filtre")) return "☕";
  if (l.includes("çay") || l.includes("cay") || l.includes("bitki çayı")) return "🫖";
  if (l.includes("su") || l.includes("soda") || l.includes("maden suyu")) return "💧";
  if (l.includes("kola") || l.includes("coke") || l.includes("fanta") || l.includes("gazoz") || l.includes("şalgam") || l.includes("salgam") || l.includes("fuse") || l.includes("tea") || l.includes("ice tea") || l.includes("soğuk çay") || l.includes("meyve suyu") || l.includes("redbull") || l.includes("monster")) return "🥤";
  if (l.includes("bira") || l.includes("beer")) return "🍺";

  return "🍽️";
}

function guessCategory(title) {
  if (!title) return "Fast Food";
  const l = title.toLowerCase();
  if (l.includes("burger") || l.includes("pizza") || l.includes("patates") || l.includes("nugget")) return "Fast Food";
  if (l.includes("tost") || l.includes("sandviç") || l.includes("sandvic") || l.includes("kumru") || l.includes("ekmek arası")) return "Tost & Sandviç";
  if (l.includes("dürüm") || l.includes("durum") || l.includes("tantuni") || l.includes("çiğ köfte") || l.includes("cig kofte") || l.includes("zater")) return "Dürüm & Çiğ Köfte";
  if (l.includes("çorba") || l.includes("corba")) return "Çorba";
  if (l.includes("döner") || l.includes("doner") || l.includes("kebap") || l.includes("iskender") || l.includes("köfte") || l.includes("kofte")) return "Döner & Kebap";
  if (l.includes("tavuk")) return "Tavuk";
  if (l.includes("makarna") || l.includes("mantı") || l.includes("manti")) return "Makarna & Mantı";
  if (l.includes("pide") || l.includes("lahmacun") || l.includes("börek") || l.includes("borek")) return "Pide & Hamur İşi";
  if (l.includes("kahvaltı") || l.includes("kahvalti") || l.includes("menemen") || l.includes("omlet")) return "Kahvaltı";
  if (l.includes("tatlı") || l.includes("tatli") || l.includes("waffle") || l.includes("pasta") || l.includes("kek")) return "Tatlı";
  if (l.includes("kahve") || l.includes("çay") || l.includes("kola") || l.includes("ayran") || l.includes("şalgam") || l.includes("salgam") || l.includes("tea") || l.includes("su")) return "İçecek";
  return "Yemek";
}

function getFlattenedMeals(mealsList) {
  const result = [];
  const sortedDays = [...mealsList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const day of sortedDays) {
    const reversedMeals = [...(day.meals || [])].reverse();
    for (const meal of reversedMeals) {
      result.push({ date: day.date, day: day.day, meal });
    }
  }
  return result;
}

async function saveNewMealToGitHub(token, meal, customDate = null, customDay = null, profile = USER_PROFILES["can"]) {
  const filePath = profile ? profile.filePath : "data/meals/can.json";
  const githubFile = await getGitHubFile(token, filePath);
  let mealsList = [];
  try {
    mealsList = JSON.parse(githubFile.content);
  } catch (e) {
    mealsList = [];
  }

  const { date: trDate, day: trDay } = getTurkeyTimeInfo();
  const targetDate = customDate || trDate;
  const targetDay = customDay || trDay;

  const newMeal = {
    id: `${targetDate}-${Date.now().toString().slice(-4)}`,
    title: meal.title,
    items: meal.items || [meal.title],
    location: meal.location || "Yurt",
    category: meal.category || "Fast Food",
    emoji: meal.emoji || "🍽️",
    price: meal.price || null,
    note: meal.note || ""
  };

  let dayEntry = mealsList.find(d => d.date === targetDate);
  if (dayEntry) {
    dayEntry.meals.push(newMeal);
  } else {
    mealsList.push({
      date: targetDate,
      day: targetDay,
      meals: [newMeal]
    });
  }

  mealsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  await updateGitHubFile(
    token,
    githubFile.sha,
    JSON.stringify(mealsList, null, 2),
    `feat(${profile.id}): ${targetDay} öğünü eklendi (${newMeal.title} - ${newMeal.price})`,
    filePath
  );

  // Can profili ise data/meals.json senkronize et
  if (profile.id === "can") {
    try {
      const syncFile = await getGitHubFile(token, "data/meals.json");
      await updateGitHubFile(token, syncFile.sha, JSON.stringify(mealsList, null, 2), `sync: meals.json`, "data/meals.json");
    } catch (e) { }
  }
}

async function parseMealWithGeminiFast(userMessage, apiKey, previousContext = null) {
  const { date: todayDateStr, day: todayDayName } = getTurkeyTimeInfo();

  const systemPrompt = `
Sen bir yemek günlüğü asistanısın. Kullanıcının Türkçe yemek mesajını analiz et.
Bugünün tarihi: ${todayDateStr} (${todayDayName}).

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

Çıktı SADECE şu JSON formatında olmalıdır:
{
  "isComplete": true,
  "missingFields": [],
  "question": null,
  "date": "YYYY-MM-DD",
  "day": "Türkçe gün adı",
  "meal": {
    "title": "Cips",
    "items": ["Cips"],
    "location": "Yurt",
    "price": "36 TL",
    "category": "Atıştırmalık",
    "emoji": "🍟",
    "note": ""
  }
}
`;

  let userContent = "";
  if (previousContext) {
    userContent = `Önceki Bilgiler ve Eksikler:\n${JSON.stringify(previousContext)}\n\nKullanıcının Yeni Yanıtı: "${userMessage}"`;
  } else {
    userContent = `Kullanıcı: "${userMessage}"`;
  }

  const models = [
    { name: "gemini-flash-lite-latest" },
    { name: "gemini-3.5-flash", budget: 0 },
    { name: "gemini-flash-latest", budget: 0 },
    { name: "gemini-3.8-flash", budget: 0 }
  ];

  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m.name}:generateContent?key=${apiKey}`;
      const genConfig = {
        responseMimeType: "application/json",
        maxOutputTokens: 1000
      };
      if (m.budget !== undefined) {
        genConfig.thinkingConfig = { thinkingBudget: m.budget };
      }

      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
          generationConfig: genConfig
        })
      });
      if (res.ok) {
        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return JSON.parse(rawText);
        }
      }
    } catch (e) { }
  }
  throw new Error("Gemini servisi meşgul.");
}

async function getGitHubFile(token, filePath = "data/meals/can.json") {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": "Can-Ne-Yedi-Worker",
      "Accept": "application/vnd.github.v3+json"
    }
  });
  if (response.status === 404) {
    return { sha: null, content: "[]" };
  }
  if (!response.ok) throw new Error(`GitHub getFile Hatası: ${response.status}`);
  const data = await response.json();
  const decodedContent = new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
  return { sha: data.sha, content: decodedContent };
}

async function updateGitHubFile(token, sha, content, message, filePath = "data/meals/can.json") {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
  const utf8Bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
  const base64Content = btoa(binary);

  const payload = {
    message,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": "Can-Ne-Yedi-Worker",
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`GitHub updateFile Hatası: ${response.status}`);
  return await response.json();
}

async function sendTelegramMessage(botToken, chatId, text, parseMode = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    const data = await res.json();
    return data.result;
  }
  return null;
}

async function editTelegramMessage(botToken, chatId, messageId, text) {
  if (!messageId) {
    return await sendTelegramMessage(botToken, chatId, text, "Markdown");
  }
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown"
  };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function deleteTelegramMessage(botToken, chatId, messageId) {
  if (!messageId) return;
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch (e) { }
}

async function sendForceReplyMessage(botToken, chatId, text, placeholder = "") {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      force_reply: true,
      input_field_placeholder: placeholder
    }
  };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function sendInlineButtonMessage(botToken, chatId, text, inlineKeyboard) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    const data = await res.json();
    return data.result;
  }
  return null;
}

async function handleInlineQuery(inlineQuery, env) {
  const query = (inlineQuery.query || "").trim();
  const inlineQueryId = inlineQuery.id;

  const results = query ? [
    {
      type: "article",
      id: "submit_meal",
      title: "✅ Düzenlemeyi Gönder",
      description: query,
      input_message_content: {
        message_text: query
      }
    }
  ] : [];

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerInlineQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inline_query_id: inlineQueryId,
      results,
      cache_time: 1
    })
  });
}

async function handleCallbackQuery(callbackQuery, env) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (data && data.startsWith("set_profile:")) {
    const profId = data.split(":")[1];
    if (USER_PROFILES[profId]) {
      userActiveProfiles.set(chatId, profId);
      const prof = USER_PROFILES[profId];

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: `Aktif profil: ${prof.name} (${prof.emoji})`
        })
      });

      const updatedText =
        `✅ *Aktif Profil Ayarlandı:* ${prof.emoji} *${prof.name}*\n\n` +
        `Artık bu sohbetten yapacağın tüm eklemeler, listelemeler ve düzenlemeler *${prof.name}* adına kaydedilecek.\n` +
        `📁 Dosya: \`${prof.filePath}\`\n\n` +
        `🌐 https://${REPO_OWNER}.github.io/${REPO_NAME}/?u=${prof.id}`;

      await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, updatedText);
      return;
    }
  }

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
}
