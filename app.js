// Kullanıcı Listesi ve Aktif Kullanıcı
let usersList = [
  {
    id: "can",
    name: "Can",
    fullName: "Can",
    avatar: "🍔",
    file: "data/meals/can.json",
    bio: "19 Ekim 2026'dan itibaren her gün ne yediyse burada kayıt altında. Hamburger tutkusu hız kesmiyor!"
  },
  {
    id: "emir",
    name: "Emir",
    fullName: "Emir",
    avatar: "🌯",
    file: "data/meals/emir.json",
    bio: "Sokak lezzetleri ve gurme keşifleri zinciri."
  },
  {
    id: "kemal",
    name: "Kemal",
    fullName: "Kemal",
    avatar: "🍕",
    file: "data/meals/kemal.json",
    bio: "Lezzet ve istikrar takibi."
  }
];

let currentUser = usersList[0]; // Varsayılan Can
let allDaysData = [];
let selectedLocation = 'all';
let searchQuery = '';
let currentStatsPeriod = 'current'; // 'current', 'prev', 'all'

// Location color palette mapping for badges
const locationColors = {
  "McDonald's": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Yurt": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Jungle Burger": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
};

function getLocationBadgeClass(loc) {
  return locationColors[loc] || "bg-purple-500/10 text-purple-400 border-purple-500/30";
}

// Akıllı Yemek/İçecek Emoji Eşleştirmesi
function getItemEmoji(item) {
  if (!item) return '🍽️';
  const l = item.toLowerCase();
  if (l.includes('burger') || l.includes('whopper') || l.includes('big mac')) return '🍔';
  if (l.includes('pizza')) return '🍕';
  if (l.includes('tost') || l.includes('sandviç') || l.includes('sandvic') || l.includes('kumru') || l.includes('ekmek arası')) return '🥪';
  if (l.includes('dürüm') || l.includes('durum') || l.includes('tantuni') || l.includes('çiğ köfte') || l.includes('cig kofte') || l.includes('wrap') || l.includes('zater')) return '🌯';
  if (l.includes('döner') || l.includes('doner') || l.includes('kebap') || l.includes('iskender')) return '🥙';
  if (l.includes('köfte') || l.includes('kofte')) return '🧆';
  if (l.includes('çorba') || l.includes('corba') || l.includes('mercimek') || l.includes('ezogelin') || l.includes('yayla') || l.includes('paça') || l.includes('paca')) return '🍲';
  if (l.includes('patates') || l.includes('fries')) return '🍟';
  if (l.includes('tavuk') || l.includes('nugget') || l.includes('şinitzel') || l.includes('sinitzel') || l.includes('kanat') || l.includes('wings') || l.includes('strips')) return '🍗';
  if (l.includes('makarna') || l.includes('spagetti') || l.includes('spaghetti') || l.includes('noodle') || l.includes('mantı') || l.includes('manti')) return '🍝';
  if (l.includes('pilav') || l.includes('pirinç')) return '🍚';
  if (l.includes('lahmacun') || l.includes('pide')) return '🫓';
  if (l.includes('börek') || l.includes('borek') || l.includes('poğaça') || l.includes('pogaca') || l.includes('simit') || l.includes('boyoz') || l.includes('açma')) return '🥐';
  if (l.includes('kahvaltı') || l.includes('kahvalti') || l.includes('menemen') || l.includes('yumurta') || l.includes('omlet')) return '🍳';
  if (l.includes('salata') || l.includes('bowl')) return '🥗';
  if (l.includes('balık') || l.includes('balik') || l.includes('sushi') || l.includes('ton balık')) return '🐟';
  if (l.includes('waffle') || l.includes('pankek') || l.includes('krep')) return '🧇';
  if (l.includes('tatlı') || l.includes('tatli') || l.includes('pasta') || l.includes('cheesecake') || l.includes('brownie') || l.includes('kek') || l.includes('sufle')) return '🍰';
  if (l.includes('dondurma')) return '🍦';
  if (l.includes('ayran') || l.includes('süt')) return '🥛';
  if (l.includes('kahve') || l.includes('latte') || l.includes('espresso') || l.includes('cappuccino') || l.includes('americano') || l.includes('filtre')) return '☕';
  if (l.includes('çay') || l.includes('cay') || l.includes('bitki çayı')) return '🫖';
  if (l.includes('su') || l.includes('soda') || l.includes('maden suyu')) return '💧';
  if (l.includes('kola') || l.includes('coke') || l.includes('fanta') || l.includes('gazoz') || l.includes('şalgam') || l.includes('salgam') || l.includes('fuse') || l.includes('tea') || l.includes('ice tea') || l.includes('soğuk çay') || l.includes('meyve suyu') || l.includes('redbull') || l.includes('monster')) return '🥤';
  if (l.includes('bira')) return '🍺';
  return '🍽️';
}

// Format ISO date to Turkish readable format
function formatDateTr(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthNames = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      const month = monthNames[parseInt(parts[1], 10) - 1];
      const day = parseInt(parts[2], 10);
      return `${day} ${month} ${year}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function getWeekBounds(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  prevMonday.setHours(0, 0, 0, 0);

  const prevSunday = new Date(monday);
  prevSunday.setDate(monday.getDate() - 1);
  prevSunday.setHours(23, 59, 59, 999);

  return {
    current: { start: monday, end: sunday },
    prev: { start: prevMonday, end: prevSunday }
  };
}

function formatShortDateTr(d) {
  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  return `${d.getDate()} ${monthNames[d.getMonth()]}`;
}

// Profil Değiştirici Butonlarını Render Et
function renderProfileSwitcher() {
  const container = document.getElementById('profileSwitcher');
  if (!container) return;

  container.innerHTML = usersList.map(u => {
    const isActive = u.id === currentUser.id;
    const activeClass = isActive 
      ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30 font-bold' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800/80 font-medium';

    return `
      <button 
        onclick="switchUser('${u.id}')" 
        class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs transition-all ${activeClass}"
        title="${u.name} Profili"
      >
        <span>${u.avatar}</span>
        <span class="inline">${u.name}</span>
      </button>
    `;
  }).join('');
}

// Kullanıcı Değiştirme Fonksiyonu
window.switchUser = async function(userId, updateUrl = true) {
  const targetUser = usersList.find(u => u.id === userId);
  if (!targetUser) return;

  currentUser = targetUser;

  // URL Query Parametresini Güncelle (?u=emir)
  if (updateUrl && window.history && window.history.pushState) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('u', currentUser.id);
    window.history.pushState({ userId: currentUser.id }, '', newUrl);
  }

  // Sayfa başlıkları ve kimliklerini güncelle
  document.title = `${currentUser.name} Ne Yedi? | Haftalık Lezzet Günlüğü`;

  const headerName = document.getElementById('headerUserName');
  if (headerName) headerName.textContent = currentUser.name;

  const headerAvatar = document.getElementById('headerUserAvatar');
  if (headerAvatar) headerAvatar.textContent = currentUser.avatar;

  const heroHeading = document.getElementById('heroUserHeading');
  if (heroHeading) heroHeading.textContent = `${currentUser.name}'ın Yemek Zinciri`;

  const heroBio = document.getElementById('heroUserBio');
  if (heroBio) heroBio.textContent = currentUser.bio || `${currentUser.name}'ın haftalık gurme günlüğü ve yemek zinciri.`;

  const footerGreeting = document.getElementById('footerUserGreeting');
  if (footerGreeting) footerGreeting.textContent = `Afiyet olsun ${currentUser.name}!`;

  renderProfileSwitcher();
  await loadMeals();
};

// Verileri Yükle
async function loadMeals() {
  selectedLocation = 'all';
  searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const targetFile = currentUser.file || `data/meals/${currentUser.id}.json`;

  try {
    const response = await fetch(`${targetFile}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allDaysData = await response.json();
  } catch (err) {
    console.warn(`Could not fetch ${targetFile}:`, err);
    allDaysData = [];
  }

  // İstatistikleri, filtreleri ve akışı hesapla
  computeStats();
  setupLocationFilters();
  renderTimeline();
}

window.setStatsPeriod = function(period) {
  currentStatsPeriod = period;
  updateStatsPeriodTabs();
  computeStats();
  if (window.lucide) lucide.createIcons();
};

function updateStatsPeriodTabs() {
  const tabs = ['current', 'prev', 'all'];
  tabs.forEach(t => {
    const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!btn) return;
    if (t === currentStatsPeriod) {
      btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-brand-500 text-white shadow-sm shadow-brand-500/20";
    } else {
      btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-white";
    }
  });
}

function getMealCalories(meal) {
  const c = meal.calories;
  return c && Number.isFinite(c.min) && Number.isFinite(c.max) && c.min >= 0 && c.max >= c.min && c.max <= 50000 ? c : null;
}

function calorieTotals(days) {
  const result = { min: 0, max: 0, estimated: 0, total: 0 };
  days.forEach(day => (day.meals || []).forEach(meal => {
    result.total++;
    const c = getMealCalories(meal);
    if (c) { result.min += c.min; result.max += c.max; result.estimated++; }
  }));
  return result;
}

function calorieRange(c) {
  return `${c.min.toLocaleString('tr-TR')}–${c.max.toLocaleString('tr-TR')} kcal`;
}

function updateCalorieStats(days) {
  const totals = calorieTotals(days);
  document.getElementById('calorieLabel').textContent = `${currentStatsPeriod === 'current' ? 'Bu Hafta' : currentStatsPeriod === 'prev' ? 'Geçen Hafta' : 'Toplam'} Tahmini Kalori`;
  document.getElementById('calorieVal').textContent = totals.estimated ? `${Math.round((totals.min + totals.max) / 2).toLocaleString('tr-TR')} kcal` : '—';
  document.getElementById('calorieCoverage').textContent = totals.total
    ? `${totals.estimated}/${totals.total} öğün hesaplandı · Yalnızca kayıtlı öğünler`
    : 'Bu dönemde öğün yok';
}

function escapeCalorieText(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function computeStats() {
  const allTimeDaysCount = allDaysData.length;

  const streakPill = document.getElementById('heroStreakPill');
  const streakStatus = document.getElementById('heroStreakStatus');
  const streakEmoji = document.getElementById('streakEmoji');
  const streakCount = document.getElementById('streakCount');

  // Boş durum (Henüz öğün eklenmemiş yeni kullanıcı)
  if (allTimeDaysCount === 0) {
    updateCalorieStats([]);
    if (streakCount) streakCount.innerText = "0 Gün";
    if (streakEmoji) streakEmoji.innerText = "🌱";
    if (streakStatus) streakStatus.innerText = "İlk Öğün Bekleniyor";
    if (streakPill) {
      streakPill.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold mb-3";
    }

    document.getElementById('totalDays').innerHTML = `<i data-lucide="calendar" class="w-4 h-4 text-brand-400"></i> 0 Gün`;
    document.getElementById('totalMeals').innerHTML = `<i data-lucide="utensils" class="w-4 h-4 text-emerald-400"></i> 0 Öğün`;
    document.getElementById('burgerCountVal').innerText = `0 Adet`;
    if (document.getElementById('colaCountVal')) {
      document.getElementById('colaCountVal').innerText = `0 Kutu`;
    }
    if (document.getElementById('expenseVal')) {
      document.getElementById('expenseVal').innerText = `0 ₺`;
    }
    document.getElementById('totalLocations').innerHTML = `<i data-lucide="map-pin" class="w-4 h-4 text-rose-400"></i> 0 Yer`;

    const rangeEl = document.getElementById('statsPeriodDateRange');
    if (rangeEl) rangeEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-500"></i> Henüz kayıt yok`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Zincir aktif
  if (streakCount) streakCount.innerText = `${allTimeDaysCount} Gün`;
  if (streakEmoji) streakEmoji.innerText = "🔥";
  if (streakStatus) streakStatus.innerText = "Zincir Kırılmıyor 🔥";
  if (streakPill) {
    streakPill.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-3";
  }

  // Calendar weeks follow today's date in Turkey, even when the latest meal is older.
  const turkeyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const refDate = new Date(turkeyDate + 'T12:00:00');

  const { current, prev } = getWeekBounds(refDate);

  const rangeEl = document.getElementById('statsPeriodDateRange');
  const labelEl = document.getElementById('expenseLabel');

  if (rangeEl) {
    if (currentStatsPeriod === 'current') {
      rangeEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-400"></i> ${formatShortDateTr(current.start)} - ${formatShortDateTr(current.end)} ${current.end.getFullYear()}`;
      if (labelEl) labelEl.innerText = "Bu Hafta Harcama";
    } else if (currentStatsPeriod === 'prev') {
      rangeEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-400"></i> ${formatShortDateTr(prev.start)} - ${formatShortDateTr(prev.end)} ${prev.end.getFullYear()}`;
      if (labelEl) labelEl.innerText = "Geçen Hafta Harcama";
    } else {
      rangeEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-400"></i> Tüm Kayıtlar (${allTimeDaysCount} Gün)`;
      if (labelEl) labelEl.innerText = "Toplam Harcama";
    }
  }

  let targetDays = allDaysData;
  if (currentStatsPeriod === 'current') {
    targetDays = allDaysData.filter(d => {
      const dt = new Date(d.date + "T12:00:00Z");
      return dt >= current.start && dt <= current.end;
    });
  } else if (currentStatsPeriod === 'prev') {
    targetDays = allDaysData.filter(d => {
      const dt = new Date(d.date + "T12:00:00Z");
      return dt >= prev.start && dt <= prev.end;
    });
  }

  updateCalorieStats(targetDays);
  const periodDaysCount = targetDays.length;
  let totalMeals = 0;
  let burgerCount = 0;
  let colaCount = 0;
  let totalExpense = 0;
  const locationsSet = new Set();

  targetDays.forEach(day => {
    (day.meals || []).forEach(meal => {
      totalMeals++;
      if (meal.location) locationsSet.add(meal.location.trim());
      
      const hasBurger = 
        (meal.title && meal.title.toLowerCase().includes('hamburger')) ||
        (meal.items && meal.items.some(item => item.toLowerCase().includes('hamburger')));
      
      if (hasBurger) burgerCount++;

      const hasCola = 
        (meal.title && meal.title.toLowerCase().includes('kola')) ||
        (meal.items && meal.items.some(item => item.toLowerCase().includes('kola')));

      if (hasCola) colaCount++;

      if (meal.price) {
        const digits = String(meal.price).replace(/[^\d]/g, '');
        if (digits) {
          totalExpense += parseInt(digits, 10);
        }
      }
    });
  });

  document.getElementById('totalDays').innerHTML = `<i data-lucide="calendar" class="w-4 h-4 text-brand-400"></i> ${periodDaysCount} Gün`;
  document.getElementById('totalMeals').innerHTML = `<i data-lucide="utensils" class="w-4 h-4 text-emerald-400"></i> ${totalMeals} Öğün`;
  document.getElementById('burgerCountVal').innerText = `${burgerCount} Adet`;
  if (document.getElementById('colaCountVal')) {
    document.getElementById('colaCountVal').innerText = `${colaCount} Kutu`;
  }
  if (document.getElementById('expenseVal')) {
    document.getElementById('expenseVal').innerText = `${totalExpense.toLocaleString('tr-TR')} ₺`;
  }
  document.getElementById('totalLocations').innerHTML = `<i data-lucide="map-pin" class="w-4 h-4 text-rose-400"></i> ${locationsSet.size} Yer`;
}

function setupLocationFilters() {
  const filterContainer = document.getElementById('locationFilters');
  const locationsSet = new Set();
  
  allDaysData.forEach(day => {
    (day.meals || []).forEach(meal => {
      if (meal.location) locationsSet.add(meal.location.trim());
    });
  });

  const locations = ['all', ...Array.from(locationsSet)];

  filterContainer.innerHTML = locations.map(loc => {
    const isAll = loc === 'all';
    const label = isAll ? 'Tümü' : `📍 ${loc}`;
    const isActive = selectedLocation === loc;
    const activeClass = isActive 
      ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20' 
      : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800';

    return `
      <button 
        onclick="setLocationFilter('${loc}')" 
        class="px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${activeClass}"
      >
        ${label}
      </button>
    `;
  }).join('');
}

window.setLocationFilter = function(loc) {
  selectedLocation = loc;
  setupLocationFilters();
  renderTimeline();
};

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  const filteredInfo = document.getElementById('mealsFilteredInfo');

  if (allDaysData.length === 0) {
    if (filteredInfo) filteredInfo.textContent = 'Kayıt bulunmuyor';
    container.innerHTML = `
      <div class="py-14 px-6 text-center bg-slate-900/60 rounded-3xl border border-slate-800/80 -ml-6 sm:-ml-8">
        <div class="text-4xl mb-3">${currentUser.avatar || '🍽️'}</div>
        <h4 class="text-base font-bold text-white mb-1">Henüz ${currentUser.name} İçin Öğün Eklenmedi</h4>
        <p class="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
          Telegram botuna yediğin yemeği, mekanı ve fiyatı yazarak (${currentUser.name} profili aktifken) ilk lezzetini hemen günlüğe ekleyebilirsin!
        </p>
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-brand-300">
          💬 "Bugün yurtta tavuk dürüm ve kola gömdüm 240 TL"
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Filtreleme
  const filteredDays = allDaysData.map(day => {
    const filteredMeals = (day.meals || []).filter(meal => {
      const matchesLocation = (selectedLocation === 'all') || (meal.location === selectedLocation);
      if (!matchesLocation) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = meal.title && meal.title.toLowerCase().includes(q);
      const inLocation = meal.location && meal.location.toLowerCase().includes(q);
      const inItems = meal.items && meal.items.some(it => it.toLowerCase().includes(q));
      const inDay = day.day && day.day.toLowerCase().includes(q);
      return inTitle || inLocation || inItems || inDay;
    });

    return {
      ...day,
      meals: filteredMeals
    };
  }).filter(day => day.meals.length > 0);

  // En yeni tarih ilk sırada
  filteredDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (selectedLocation !== 'all' || searchQuery.trim()) {
    filteredInfo.textContent = `Filtrelendi (${filteredDays.reduce((acc, d) => acc + d.meals.length, 0)} öğün bulundu)`;
  } else {
    filteredInfo.textContent = 'En güncelden eskiye tüm günler';
  }

  if (filteredDays.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
        <div class="text-3xl mb-2">🔍</div>
        <h4 class="text-sm font-semibold text-white">Eşleşen öğün bulunamadı</h4>
        <p class="text-xs text-slate-500 mt-1">Arama filtrenizi temizleyip tekrar deneyin.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filteredDays.map((day, dayIndex) => {
    const formattedDate = formatDateTr(day.date);
    const mealCount = day.meals.length;
    const isTodayOrLatest = dayIndex === 0;

    const mealsHtml = day.meals.map(meal => {
      const calories = getMealCalories(meal);
      const locBadgeClass = getLocationBadgeClass(meal.location);
      const itemsBadges = (meal.items || []).map(item => {
        const isDrink = ['ayran', 'kola', 'su', 'fanta', 'gazoz', 'kahve', 'çay', 'fuse', 'tea', 'şeftali', 'şalgam', 'salgam', 'soda', 'redbull', 'süt'].some(d => item.toLowerCase().includes(d));
        const badgeEmoji = getItemEmoji(item);
        return `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${isDrink ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'bg-slate-800 text-slate-200 border border-slate-700/60'}">
            ${badgeEmoji} ${item}
          </span>
        `;
      }).join('');

      return `
        <div class="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm hover:shadow-md">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform flex-shrink-0">
                ${meal.emoji && meal.emoji !== '🍽️' ? meal.emoji : getItemEmoji(meal.title)}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-base font-bold text-white group-hover:text-brand-400 transition-colors">
                    ${meal.title}
                  </h4>
                  ${meal.price ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      💰 ${meal.price}
                    </span>
                  ` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-2">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${locBadgeClass}">
                    <i data-lucide="map-pin" class="w-3 h-3"></i>
                    ${meal.location}
                  </span>
                  ${calories ? `
                    <span class="text-xs font-semibold text-orange-300">🔥 Tahmini ${calorieRange(calories)}</span>
                  ` : '<span class="text-[11px] text-slate-500">Kalori tahmini yok</span>'}
                  ${meal.category ? `
                    <span class="text-[11px] text-slate-400 font-medium">
                      • ${meal.category}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          ${calories?.portions ? `<p class="text-[11px] text-slate-500 mt-3">Porsiyon varsayımı: ${escapeCalorieText(calories.portions)}</p>` : ''}
          <!-- Items pills & note -->
          <div class="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              ${itemsBadges}
            </div>
            ${meal.note ? `
              <span class="text-[11px] italic text-slate-500 flex items-center gap-1">
                <i data-lucide="message-square" class="w-3 h-3"></i> ${meal.note}
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="relative group">
        <!-- Timeline node dot -->
        <div class="absolute -left-[31px] sm:-left-[39px] top-1.5 w-6 h-6 rounded-full bg-slate-950 border-2 ${isTodayOrLatest ? 'border-brand-500 shadow-lg shadow-brand-500/50 ring-4 ring-brand-500/20' : 'border-slate-700'} flex items-center justify-center text-[10px]">
          ${isTodayOrLatest ? '🔥' : '✨'}
        </div>

        <!-- Day Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2.5">
            <span class="text-sm font-extrabold text-white tracking-wide">
              ${day.day}
            </span>
            <span class="text-xs font-medium text-slate-400">
              ${formattedDate}
            </span>
            ${isTodayOrLatest ? `
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase tracking-wider">
                Son Gün
              </span>
            ` : ''}
          </div>

          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
            ${mealCount} ${mealCount > 1 ? 'farklı öğün' : 'öğün'}
          </span>
        </div>

        <!-- Meal Cards -->
        <div class="grid grid-cols-1 ${mealCount > 1 ? 'md:grid-cols-2' : ''} gap-3">
          ${mealsHtml}
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// Search input listener
const searchEl = document.getElementById('searchInput');
if (searchEl) {
  searchEl.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTimeline();
  });
}

// Modal Logic
const modal = document.getElementById('infoModal');
const openModalBtn = document.getElementById('infoModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDoneBtn = document.getElementById('modalDoneBtn');
const copySnippetBtn = document.getElementById('copySnippetBtn');
const copyText = document.getElementById('copyText');
const sampleSnippet = document.getElementById('sampleJsonSnippet');

function openModal() {
  if (modal) modal.classList.remove('hidden');
}
function closeModal() {
  if (modal) modal.classList.add('hidden');
}

if (openModalBtn) openModalBtn.addEventListener('click', openModal);
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (modalDoneBtn) modalDoneBtn.addEventListener('click', closeModal);

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

if (copySnippetBtn && sampleSnippet) {
  copySnippetBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sampleSnippet.innerText);
      if (copyText) copyText.innerText = 'Kopyalandı! ✓';
      setTimeout(() => {
        if (copyText) copyText.innerText = 'Kopyala';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  });
}

// Tarayıcı Geri/İleri Butonları Dinle
window.addEventListener('popstate', (e) => {
  const urlParams = new URLSearchParams(window.location.search);
  const u = urlParams.get('u') || urlParams.get('user') || 'can';
  switchUser(u, false);
});

// Initial boot
document.addEventListener('DOMContentLoaded', async () => {
  // users.json'ı yüklemeye çalış
  try {
    const usersRes = await fetch('data/users.json?t=' + Date.now());
    if (usersRes.ok) {
      const fetchedUsers = await usersRes.json();
      if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) {
        usersList = fetchedUsers;
      }
    }
  } catch (e) {
    console.warn('Could not fetch data/users.json, using defaults.', e);
  }

  // URL'den kullanıcı parametresini al (?u=emir veya ?user=can)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedUserId = urlParams.get('u') || urlParams.get('user');

  if (requestedUserId) {
    const matched = usersList.find(u => u.id.toLowerCase() === requestedUserId.toLowerCase());
    if (matched) {
      currentUser = matched;
    }
  }

  // Arayüzü başlat
  switchUser(currentUser.id, false);
});
