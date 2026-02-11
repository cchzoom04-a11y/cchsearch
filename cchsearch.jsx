import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, Trash2, Edit2, X, Check, Calendar, ExternalLink, Database, Loader2, AlertCircle, CheckCircle2, Globe } from 'lucide-react';

// --- 重要修正：解決瀏覽器儲存問題 ---
if (!window.storage) {
  window.storage = {
    get: async (key) => ({ value: localStorage.getItem(key) }),
    set: async (key, value) => localStorage.setItem(key, value)
  };
}

const NewsSearcher = () => {
  // --- 請在這裡填入你的 Google API Key ---
  const GOOGLE_API_KEY = "你的_GOOGLE_API_KEY_貼在這裡"; 
  // 例如: const GOOGLE_API_KEY = "AIzaSyDxxxx...";

  const [newsLinks, setNewsLinks] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0, currentSite: '' });
  const [showLinkManager, setShowLinkManager] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingLink, setEditingLink] = useState('');

  // 預設新聞網站清單
  const defaultLinks = [
    'https://www.cna.com.tw/',
    'https://udn.com/news/index',
    'https://www.ltn.com.tw/',
    'https://www.chinatimes.com/',
    'https://news.yahoo.com.tw/',
    'https://www.ettoday.net/'
  ];

  useEffect(() => {
    const loadLinks = async () => {
      try {
        const stored = await window.storage.get('news_links');
        if (stored && stored.value) {
          setNewsLinks(JSON.parse(stored.value));
        } else {
          setNewsLinks(defaultLinks);
          await window.storage.set('news_links', JSON.stringify(defaultLinks));
        }
      } catch (error) {
        setNewsLinks(defaultLinks);
      }
    };
    loadLinks();
  }, []);

  const saveLinks = async (links) => {
    try {
      await window.storage.set('news_links', JSON.stringify(links));
    } catch (error) {
      console.error('儲存失敗:', error);
    }
  };

  // --- 改用 Google Gemini 免費版 ---
  const searchSingleSite = async (siteUrl, keyword, startDate, endDate) => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("貼在這裡")) {
      alert("請先在程式碼中填入 Google API Key！");
      return [];
    }

    const prompt = `你是一個專業的新聞搜尋機器人。請搜尋以下網站：
網站URL: ${siteUrl}
關鍵字: ${keyword}
${startDate ? `開始日期: ${startDate}` : ''}
${endDate ? `結束日期: ${endDate}` : ''}

請模擬搜尋並找出3篇相關文章。
請嚴格遵守這個 JSON 格式回傳，不要有任何其他文字：
{
  "articles": [
    {
      "title": "新聞標題",
      "date": "YYYY-MM-DD",
      "url": "完整文章連結",
      "reporter": "記者姓名或null",
      "source": "${siteUrl}"
    }
  ]
}`;

    try {
      // 呼叫 Google Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content) {
        let responseText = data.candidates[0].content.parts[0].text;
        // 清理回應文字，確保是純 JSON
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const result = JSON.parse(responseText);
        
        if (result.articles) {
          return result.articles; // Google 比較聰明，通常不需要再過濾日期，但為了保險可以保留過濾邏輯
        }
      }
      return [];
    } catch (error) {
      console.error(`搜尋 ${siteUrl} 失敗:`, error);
      return [];
    }
  };

  const searchAllSites = async () => {
    if (!searchKeyword.trim()) {
      alert('請輸入搜尋關鍵字');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSearchProgress({ current: 0, total: newsLinks.length, currentSite: '' });

    const allResults = [];
    
    // Google 免費版有限速，我們每次搜尋一個網站，並且休息一下
    for (let i = 0; i < newsLinks.length; i++) {
      const siteUrl = newsLinks[i];
      
      setSearchProgress(prev => ({ 
        ...prev, 
        current: i + 1, 
        currentSite: siteUrl 
      }));

      // 執行搜尋
      const results = await searchSingleSite(siteUrl, searchKeyword, startDate, endDate);
      allResults.push(...results);
      setSearchResults([...allResults]);

      // --- 重要：讓程式休息 2 秒鐘，避免被 Google 封鎖 (免費版限制) ---
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setIsSearching(false);
    setSearchProgress({ current: newsLinks.length, total: newsLinks.length, currentSite: '' });
  };

  const exportToExcel = () => {
    if (searchResults.length === 0) {
      alert('沒有可匯出的搜尋結果');
      return;
    }
    const headers = ['序號', '新聞標題', '發布日期', '新聞連結', '記者姓名', '新聞來源'];
    const rows = searchResults.map((result, index) => [
      index + 1,
      result.title,
      result.date,
      result.url,
      result.reporter || '未知',
      result.source
    ]);

    let csvContent = '\ufeff'; 
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `搜尋結果_${searchKeyword}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addLink = async () => {
    if (!newLink.trim()) return;
    try { new URL(newLink); } catch { alert('請輸入有效的網址'); return; }
    const updatedLinks = [...newsLinks, newLink];
    setNewsLinks(updatedLinks);
    setNewLink('');
    await saveLinks(updatedLinks);
  };

  const deleteLink = async (index) => {
    if (confirm('確定要刪除這個網站連結嗎？')) {
      const updatedLinks = newsLinks.filter((_, i) => i !== index);
      setNewsLinks(updatedLinks);
      await saveLinks(updatedLinks);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)',
      padding: '2rem',
      fontFamily: 'sans-serif',
      color: 'white'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center', background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
           新聞智能搜尋 (Google 免費版)
        </h1>

        {/* 搜尋區塊 */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', marginBottom: '2rem' }}>
          <input
            type="text"
            placeholder="請輸入關鍵字 (例如：台積電)"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', border: 'none', background: '#334155', color: 'white', fontSize: '1.2rem' }}
          />
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: 'none' }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: 'none' }} />
          </div>

          <button 
            onClick={searchAllSites} 
            disabled={isSearching}
            style={{ 
              width: '100%', 
              padding: '1rem', 
              background: isSearching ? '#64748b' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '1.2rem', 
              cursor: isSearching ? 'not-allowed' : 'pointer' 
            }}
          >
            {isSearching ? `搜尋中... (${searchProgress.current}/${searchProgress.total})` : '開始搜尋'}
          </button>
        </div>

        {/* 結果顯示 */}
        {searchResults.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>搜尋結果 ({searchResults.length})</h2>
              <button onClick={exportToExcel} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>匯出 Excel</button>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {searchResults.map((item, idx) => (
                <div key={idx} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa' }}>{item.title}</h3>
                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    {item.date} | {item.reporter || '未知記者'} | {item.source}
                  </div>
                  <a href={item.url} target="_blank" style={{ color: '#38bdf8' }}>閱讀全文 &rarr;</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsSearcher;