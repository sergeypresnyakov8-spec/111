import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Shift, Rates, TabPeriod } from './types';
import { fetchUsers, fetchSchedule } from './services/googleSheets';
import { Icons, MONTHS } from './constants';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('shift_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [currentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [rawSchedule, setRawSchedule] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState<TabPeriod>(currentDate.getDate() <= 15 ? 'first' : 'second');

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Показываем баннер через 3 секунды после загрузки, если установка возможна
      setTimeout(() => setShowInstallBanner(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const lastDayOfMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const list = await fetchUsers();
      setUsersList(list);
      setLoadingUsers(false);
    };
    loadUsers();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingSchedule(true);
    const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
    const data = await fetchSchedule(monthStr);
    setRawSchedule(data);
    setLoadingSchedule(false);
  }, [user, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = usersList.find(u => u.name.trim().toLowerCase() === selectedName.trim().toLowerCase());
    if (foundUser && String(foundUser.password || foundUser.id) === String(password)) {
      setUser(foundUser);
      localStorage.setItem('shift_user', JSON.stringify(foundUser));
      setAuthError(false);
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 500);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('shift_user');
  };

  const parseHours = (val: any): number => {
    if (!val) return 0;
    const cleanVal = String(val).replace(',', '.').trim();
    const num = parseFloat(cleanVal);
    return isNaN(num) ? 0 : num;
  };

  const processedShifts = useMemo(() => {
    if (!rawSchedule.length || !user) return [];
    const searchName = user.name.trim().toLowerCase();
    const headerRow = rawSchedule.find(r => r.some((cell: any) => String(cell).includes("ФИО")));
    if (!headerRow) return [];
    const headerIdx = rawSchedule.indexOf(headerRow);
    const rows = rawSchedule.slice(headerIdx + 1);
    const shifts: Shift[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowName = String(row[0] || "").trim().toLowerCase();
      
      if (rowName === searchName) {
        const rowDay = rows[i];
        const rowNight = rows[i+1] || [];
        
        const isExtra = String(rowDay[1] || "").toUpperCase().includes("ПОДРАБОТКА");

        for (let d = 1; d <= lastDayOfMonth; d++) {
          const colIdx = d <= 15 ? 5 + d : 9 + d;
          const hD = parseHours(rowDay[colIdx]);
          const hN = parseHours(rowNight[colIdx]);
          const dateObj = new Date(selectedYear, selectedMonth, d);
          const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
          
          if (hD > 0) {
            shifts.push({ 
              day: d, type: 'DAY', hours: hD, isExtra, 
              time: '08:00-20:00', label: weekday 
            });
          }
          if (hN > 0) {
            shifts.push({ 
              day: d, type: 'NIGHT', hours: hN, isExtra, 
              time: '20:00-08:00', label: weekday 
            });
          }
        }
        i++;
      }
    }
    return shifts.sort((a, b) => a.day - b.day || (a.type === 'DAY' ? -1 : 1));
  }, [rawSchedule, user, selectedMonth, selectedYear, lastDayOfMonth]);

  const filteredShifts = useMemo(() => processedShifts.filter(s => activeTab === 'first' ? s.day <= 15 : s.day > 15), [processedShifts, activeTab]);

  const totalHours = useMemo(() => {
    return processedShifts.reduce((sum, s) => sum + s.hours, 0);
  }, [processedShifts]);

  const changeMonth = (d: number) => {
    let nm = selectedMonth + d;
    let ny = selectedYear;
    if (nm < 0) { nm = 11; ny -= 1; }
    else if (nm > 11) { nm = 0; ny += 1; }
    setSelectedMonth(nm);
    setSelectedYear(ny);
  };

  const monthShort = MONTHS[selectedMonth].substring(0, 3).toUpperCase();

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-white px-8 items-center justify-center safe-pt safe-pb">
        <form className={`w-full max-w-sm ${authError ? 'animate-shake' : ''}`} onSubmit={handleLogin}>
          <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">Вход</h1>
          <div className="space-y-4">
            <select 
              className="w-full bg-slate-100 h-14 px-4 rounded-xl outline-none font-semibold text-slate-900 appearance-none border-2 border-transparent focus:border-slate-200"
              value={selectedName}
              onChange={e => setSelectedName(e.target.value)}
            >
              <option value="">Выберите имя</option>
              {usersList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <input 
              type="password" 
              placeholder="Пароль" 
              className="w-full bg-slate-100 h-14 px-4 rounded-xl outline-none font-semibold text-slate-900 border-2 border-transparent focus:border-slate-200"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="w-full bg-[#273561] text-white h-14 rounded-xl font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-all">
              Войти
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] safe-pt safe-pb overflow-hidden">
      {/* HEADER */}
      <header className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100">
        <h1 className="text-2xl font-black text-[#1E293B] tracking-tight">Мои смены</h1>
        <div className="flex items-center gap-4">
          <button onClick={handleLogout} className="text-slate-300 active:scale-90 transition-transform">
            <Icons.LogOut size={22} />
          </button>
        </div>
      </header>

      {/* MONTH SELECTOR */}
      <div className="flex items-center justify-between px-6 py-4 bg-white">
        <button onClick={() => changeMonth(-1)} className="text-slate-300 active:scale-75 transition-transform"><Icons.ChevronLeft size={24} /></button>
        <span className="text-lg font-black text-slate-800">{MONTHS[selectedMonth]} {selectedYear}</span>
        <button onClick={() => changeMonth(1)} className="text-slate-300 active:scale-75 transition-transform"><Icons.ChevronRight size={24} /></button>
      </div>

      {/* TABS */}
      <div className="px-6 pb-4 bg-white">
        <div className="bg-[#F1F5F9] p-1 rounded-2xl flex gap-1">
          <button 
            onClick={() => setActiveTab('first')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-tighter ${activeTab === 'first' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
          >
            1—15 {monthShort}
          </button>
          <button 
            onClick={() => setActiveTab('second')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-tighter ${activeTab === 'second' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
          >
            16—{lastDayOfMonth} {monthShort}
          </button>
        </div>
      </div>

      {/* SHIFTS LIST */}
      <main className="flex-1 overflow-y-auto px-6 py-2">
        {loadingSchedule ? (
          <div className="flex justify-center py-12 text-slate-300 font-bold uppercase tracking-widest text-[10px]">Загрузка...</div>
        ) : filteredShifts.length === 0 ? (
          <div className="text-center py-12 text-slate-300 font-bold italic text-sm">Нет смен в этом периоде</div>
        ) : (
          <div className="space-y-3 pb-24">
            {filteredShifts.map((s, i) => (
              <div key={i} className="bg-white rounded-[1.8rem] flex items-stretch overflow-hidden card-shadow h-28 border border-slate-50">
                <div className="w-20 flex flex-col items-center justify-center border-r border-slate-50/50">
                  <div className="text-3xl font-black text-slate-900 leading-none">{s.day}</div>
                  <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{s.label} {monthShort}</div>
                </div>

                <div className="flex-1 flex flex-col justify-center px-5 relative">
                  {s.isExtra && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#10B981] text-[8px] text-white px-2 py-0.5 rounded font-black uppercase tracking-wider mb-1">
                      ПОДРАБОТКА
                    </div>
                  )}
                  <div className={`flex items-center gap-2.5 ${s.isExtra ? 'mt-4' : ''}`}>
                    {s.type === 'DAY' ? <Icons.Sun size={18} className="text-amber-500" /> : <Icons.Moon size={18} className="text-indigo-600" />}
                    <span className="font-black text-slate-900 text-[15px] uppercase tracking-tight">{s.type === 'DAY' ? 'Дневная' : 'Ночная'}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5 tracking-tight">{s.time}</div>
                </div>

                <div className="w-24 bg-[#273561] flex items-center justify-center">
                  <div className="text-white text-2xl font-black flex items-baseline gap-0.5">
                    {s.hours}<span className="text-[12px] font-bold opacity-80 uppercase">ч</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white py-6 border-t border-slate-100 flex justify-center pb-[calc(1.5rem+var(--safe-bottom))]">
        <div className="text-lg font-black text-slate-900 uppercase tracking-tighter">
          ИТОГО ЗА МЕСЯЦ: <span className="text-[#273561]">{totalHours} Ч</span>
        </div>
      </footer>

      {/* PWA INSTALL BANNER */}
      {showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-slide-up">
          <div className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
               <div className="w-8 h-8 bg-[#273561] rounded-lg"></div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-black text-slate-900">Установить приложение?</div>
              <div className="text-xs font-bold text-slate-400">Добавьте на главный экран для быстрого доступа</div>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleInstall}
                className="bg-[#273561] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter"
              >
                Установить
              </button>
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="text-slate-400 text-[10px] font-bold uppercase tracking-widest text-center"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
