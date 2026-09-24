/**
 * app.js - 기부태익 (期赴泰益) v1.00 : 경조사에 때맞춰 찾아가(期赴) 큰 보탬을 나눈다(泰益)
 * 경조사 수지 장부 및 인맥 관리 프로그램 핵심 비즈니스 로직
 * K-Traditional Modern 디자인 시스템, 무서버 로컬 퍼스트 아키텍처 및 SheetJS(XLSX) 대량 처리
 */

(function () {
  'use strict';

  // 로컬 스토리지 키
  const STORAGE_KEY = 'GIVE_TAKE_RECORDS_V1';
  const CONTACTS_STORAGE_KEY = 'GIVE_TAKE_CONTACTS_V1';

  // 애플리케이션 상태
  let state = {
    records: [],
    contacts: [], // 엑셀로 업로드된 단독 지인 명단
    currentTab: 'tab-dashboard',
    rankMode: 'creditor', // 'creditor' (내가 많이 준 분) | 'debtor' (내게 많이 주신 분)
    editingRecordId: null,
    qrPages: [],
    qrCurrentPageIndex: 0
  };

  // ==========================================================================
  // 초기화 및 수명주기
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initHeartbeat();
    loadRecords();
    initEventListeners();
    updateLocalIpGuide();
    checkUrlHashSync();

    if (state.records.length === 0 && state.contacts.length === 0) {
      showToast('새 장부입니다. 상단의 [샘플 불러오기]를 누르면 시연 데이터를 체험할 수 있습니다.');
    }
  });

  // 백엔드 C# 런처를 위한 3초 주기 하트비트 (Skill 1)
  function initHeartbeat() {
    setInterval(() => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {
        // 단독 정적 웹 환경(GitHub Pages 등)에서는 무시됨
      });
    }, 3000);
  }

  // 로컬 IP 안내 업데이트
  function updateLocalIpGuide() {
    const guideEl = document.getElementById('localIpGuide');
    if (guideEl) {
      const port = window.location.port || '80';
      const host = window.location.hostname || '127.0.0.1';
      guideEl.textContent = `현재 접속: http://${host}:${port}/ (동일 WiFi 접속 가능)`;
    }
  }

  // ==========================================================================
  // 데이터 영속성 (Local-First Storage)
  // ==========================================================================
  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      state.records = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load records:', e);
      state.records = [];
    }

    try {
      const savedContacts = localStorage.getItem(CONTACTS_STORAGE_KEY);
      state.contacts = savedContacts ? JSON.parse(savedContacts) : [];
    } catch (e) {
      console.error('Failed to load contacts:', e);
      state.contacts = [];
    }

    refreshAllViews();
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(state.contacts));
      refreshAllViews();
    } catch (e) {
      console.error('Failed to save records:', e);
      showToast('저장 공간 오류가 발생했습니다.', 'warn');
    }
  }

  function refreshAllViews() {
    renderDashboard();
    renderLedger();
    renderContacts();
    updateSampleUI();
  }

  // ==========================================================================
  // 샘플 데이터 관리 (기존 데이터 완벽 보존 & 원클릭 샘플 삭제)
  // ==========================================================================
  function loadSampleData() {
    const hasSample = state.records.some(r => r.isSample || (r.id && r.id.startsWith('rec_sample_')));
    if (hasSample) {
      showToast('이미 시연용 샘플 데이터 8건이 로드되어 있습니다.', 'info');
      return;
    }

    const samples = [
      {
        id: 'rec_sample_1',
        isSample: true,
        type: 'take',
        date: '2025-05-18',
        category: '축의',
        name: '이민호',
        phone: '010-3456-7890',
        group: '직장',
        eventName: '내 결혼식 축의금',
        amount: 200000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '회사 사수, 호텔 식사 참석'
      },
      {
        id: 'rec_sample_2',
        isSample: true,
        type: 'give',
        date: '2024-03-10',
        category: '축의',
        name: '이민호',
        phone: '010-3456-7890',
        group: '직장',
        eventName: '사수 첫째 돌잔치',
        amount: 100000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '선물 별도 전달'
      },
      {
        id: 'rec_sample_3',
        isSample: true,
        type: 'give',
        date: '2024-11-02',
        category: '축의',
        name: '박서준',
        phone: '010-8899-1122',
        group: '친구',
        eventName: '고등학교 동창 결혼식',
        amount: 150000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '강남 호텔 예식'
      },
      {
        id: 'rec_sample_4',
        isSample: true,
        type: 'give',
        date: '2025-01-15',
        category: '조의',
        name: '정우성',
        phone: '010-5544-3322',
        group: '직장',
        eventName: '부친상 조의금',
        amount: 100000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '서울성모 장례식장'
      },
      {
        id: 'rec_sample_5',
        isSample: true,
        type: 'take',
        date: '2025-05-18',
        category: '축의',
        name: '정우성',
        phone: '010-5544-3322',
        group: '직장',
        eventName: '내 결혼식 축의금',
        amount: 100000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '동일 금액 품앗이 완료'
      },
      {
        id: 'rec_sample_6',
        isSample: true,
        type: 'give',
        date: '2023-09-20',
        category: '축의',
        name: '최유진',
        phone: '010-7766-5544',
        group: '친척',
        eventName: '사촌 동생 결혼식',
        amount: 300000,
        attendance: '참석(식사)',
        isPumasi: true,
        isThanked: true,
        memo: '부모님 대신 전달한 친척 축의'
      },
      {
        id: 'rec_sample_7',
        isSample: true,
        type: 'give',
        date: '2024-06-12',
        category: '기타',
        name: '김태리',
        phone: '010-1234-9988',
        group: '친구',
        eventName: '카페 개업식 화환 및 축하금',
        amount: 100000,
        attendance: '참석(식사)',
        isPumasi: false,
        isThanked: true,
        memo: '화환 7만원 + 봉투 3만원'
      },
      {
        id: 'rec_sample_8',
        isSample: true,
        type: 'take',
        date: '2025-05-18',
        category: '축의',
        name: '강동원',
        phone: '010-9988-7766',
        group: '동호회',
        eventName: '내 결혼식 축의금',
        amount: 100000,
        attendance: '불참(봉투전달)',
        isPumasi: false,
        isThanked: true,
        memo: '계좌 송금으로 축하'
      }
    ];

    // 기존 사용자 입력 데이터를 100% 보존하면서 샘플을 추가
    state.records = [...samples, ...state.records];
    saveRecords();
    if (typeof window.fireBigCelebration === 'function') {
      window.fireBigCelebration();
    }
    showToast('📜 시연용 샘플 8건이 추가되었습니다! (기존 데이터 완벽 보존)', 'success');
  }

  async function removeSampleData() {
    const ok = await AppModal.confirm(
      '샘플 데이터 삭제',
      '시연용 샘플 내역 8건을 삭제하시겠습니까?\n(직접 등록하신 소중한 데이터는 안전하게 보존됩니다)',
      { danger: true, okText: '샘플만 삭제', stamp: '整頓' }
    );

    if (ok) {
      state.records = state.records.filter(r => !r.isSample && (!r.id || !r.id.startsWith('rec_sample_')));
      saveRecords();
      showToast('🗑️ 시연용 샘플 내역이 모두 삭제되었습니다.', 'warn');
    }
  }

  function updateSampleUI() {
    const btnRemove = document.getElementById('btnRemoveSampleData');
    const hasSample = state.records.some(r => r.isSample || (r.id && r.id.startsWith('rec_sample_')));
    if (btnRemove) {
      btnRemove.style.display = hasSample ? 'inline-flex' : 'none';
    }
  }

  // ==========================================================================
  // 대시보드 렌더링 (통계, 밸런스 미터, 랭킹)
  // ==========================================================================
  function renderDashboard() {
    let totalGive = 0;
    let countGive = 0;
    let totalTake = 0;
    let countTake = 0;

    const catStats = {
      '축의': { give: 0, take: 0 },
      '조의': { give: 0, take: 0 },
      '기타': { give: 0, take: 0 }
    };

    const contactMap = {};

    // 1. 단독 등록된 인맥 먼저 반영
    (state.contacts || []).forEach(c => {
      const key = c.phone || c.name;
      if (!contactMap[key]) {
        contactMap[key] = {
          name: c.name,
          phone: c.phone,
          group: c.group || '기타',
          give: 0,
          take: 0,
          count: 0
        };
      }
    });

    // 2. 장부 거래 내역 집계
    state.records.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'give') {
        totalGive += amt;
        countGive++;
        if (catStats[r.category]) catStats[r.category].give += amt;
      } else {
        totalTake += amt;
        countTake++;
        if (catStats[r.category]) catStats[r.category].take += amt;
      }

      const key = r.phone || r.name;
      if (!contactMap[key]) {
        contactMap[key] = {
          name: r.name,
          phone: r.phone,
          group: r.group,
          give: 0,
          take: 0,
          count: 0
        };
      }
      if (r.type === 'give') contactMap[key].give += amt;
      else contactMap[key].take += amt;
      contactMap[key].count++;
    });

    const netBalance = totalTake - totalGive;

    // 상단 통계 카드 업데이트
    document.getElementById('dashTotalGive').textContent = formatWon(totalGive);
    document.getElementById('dashCountGive').textContent = `${countGive}회`;
    document.getElementById('dashTotalTake').textContent = formatWon(totalTake);
    document.getElementById('dashCountTake').textContent = `${countTake}회`;

    const balEl = document.getElementById('dashTotalBalance');
    const balRateEl = document.getElementById('dashBalanceRate');
    const balSubEl = document.getElementById('dashBalanceSubLabel');

    if (netBalance >= 0) {
      balEl.textContent = `+${formatWon(netBalance)}`;
      balEl.className = 'stat-card-value val-balance-plus';
      balSubEl.textContent = '순흑자 (받은 돈 우세)';
    } else {
      balEl.textContent = `-${formatWon(Math.abs(netBalance))}`;
      balEl.className = 'stat-card-value val-balance-minus';
      balSubEl.textContent = '순지출 (보낸 돈 우세)';
    }

    const totalVolume = totalGive + totalTake;
    let recoveryRate = totalGive > 0 ? Math.round((totalTake / totalGive) * 100) : (totalTake > 0 ? 100 : 0);
    balRateEl.textContent = `회수율 ${recoveryRate}%`;

    document.getElementById('dashContactCount').textContent = `${Object.keys(contactMap).length}명`;
    document.getElementById('dashTotalRecordCount').textContent = `${state.records.length}건`;

    // 밸런스 미터 업데이트
    let givePct = 50;
    let takePct = 50;
    if (totalVolume > 0) {
      givePct = Math.round((totalGive / totalVolume) * 100);
      takePct = 100 - givePct;
    }
    document.getElementById('meterGivePct').textContent = `${givePct}%`;
    document.getElementById('meterTakePct').textContent = `${takePct}%`;
    document.getElementById('meterGiveBar').style.width = `${givePct}%`;
    document.getElementById('meterTakeBar').style.width = `${takePct}%`;
    document.getElementById('meterGiveBar').textContent = givePct >= 12 ? `보냄 ${givePct}%` : '';
    document.getElementById('meterTakeBar').textContent = takePct >= 12 ? `받음 ${takePct}%` : '';

    renderCategoryBars(catStats);
    renderRanking(contactMap);
    renderRecentRecords();
  }

  function renderCategoryBars(catStats) {
    const cats = [
      { key: '축의', amtId: 'catCongratAmount', giveBar: 'catCongratBarGive', takeBar: 'catCongratBarTake' },
      { key: '조의', amtId: 'catCondolenceAmount', giveBar: 'catCondolenceBarGive', takeBar: 'catCondolenceBarTake' },
      { key: '기타', amtId: 'catEtcAmount', giveBar: 'catEtcBarGive', takeBar: 'catEtcBarTake' }
    ];

    cats.forEach(c => {
      const data = catStats[c.key] || { give: 0, take: 0 };
      const sum = data.give + data.take;
      document.getElementById(c.amtId).textContent = `보냄 ${formatWon(data.give)} / 받음 ${formatWon(data.take)}`;
      
      const givePct = sum > 0 ? Math.round((data.give / sum) * 100) : 0;
      const takePct = sum > 0 ? (100 - givePct) : 0;
      document.getElementById(c.giveBar).style.width = `${givePct}%`;
      document.getElementById(c.takeBar).style.width = `${takePct}%`;
    });
  }

  function renderRanking(contactMap) {
    const container = document.getElementById('rankingContainer');
    const btnCreditor = document.getElementById('btnRankCreditor');
    const btnDebtor = document.getElementById('btnRankDebtor');

    if (state.rankMode === 'creditor') {
      btnCreditor.className = 'btn btn-vermilion';
      btnDebtor.className = 'btn btn-outline';
    } else {
      btnCreditor.className = 'btn btn-outline';
      btnDebtor.className = 'btn btn-primary';
    }

    const contacts = Object.values(contactMap).filter(c => c.count > 0);

    if (state.rankMode === 'creditor') {
      contacts.sort((a, b) => (b.give - b.take) - (a.give - a.take));
    } else {
      contacts.sort((a, b) => (b.take - b.give) - (a.take - a.give));
    }

    const top5 = contacts.slice(0, 5);

    if (top5.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--color-secondary); font-size: 13px;">등록된 경조사 내역이 없습니다.</div>`;
      return;
    }

    container.innerHTML = top5.map((c, idx) => {
      const net = c.give - c.take;
      const rankBadgeClass = idx === 0 ? 'rank-top1' : idx === 1 ? 'rank-top2' : idx === 2 ? 'rank-top3' : '';
      
      let amountDisplay = '';
      if (state.rankMode === 'creditor') {
        amountDisplay = `<span class="ranking-amount val-vermilion">+${formatWon(Math.max(0, net))}</span>`;
      } else {
        amountDisplay = `<span class="ranking-amount val-jade">+${formatWon(Math.max(0, -net))}</span>`;
      }

      return `
        <div class="ranking-item" onclick="openContactTimeline('${c.phone || c.name}')" style="cursor: pointer;">
          <div class="ranking-person">
            <div class="ranking-badge ${rankBadgeClass}">${idx + 1}</div>
            <div class="person-name-group">
              <span class="person-name">${escapeHtml(c.name)}</span>
              <span class="person-meta">${escapeHtml(c.group)} · ${escapeHtml(c.phone || '연락처 없음')}</span>
            </div>
          </div>
          <div class="ranking-amount-box">
            ${amountDisplay}
            <div class="ranking-sub-detail">보냄 ${formatWon(c.give)} · 받음 ${formatWon(c.take)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRecentRecords() {
    const container = document.getElementById('dashRecentRecords');
    const sorted = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (sorted.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 18px; color: var(--color-secondary); font-size: 13px;">최근 거래 내역이 없습니다.</div>`;
      return;
    }

    container.innerHTML = sorted.map(r => {
      const isGive = r.type === 'give';
      const badgeClass = isGive ? 'badge-give' : 'badge-take';
      const label = isGive ? '보냄' : '받음';
      const valClass = isGive ? 'val-vermilion' : 'val-jade';

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #FFFDF9; border: 1px solid var(--border-stone); border-radius: 12px; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge-tag ${badgeClass}">${label}</span>
            <span style="font-weight: 700; color: var(--color-ink);">${escapeHtml(r.name)}</span>
            <span style="color: var(--color-secondary); font-size: 12px;">${escapeHtml(r.eventName)}</span>
            <span style="color: #999; font-size: 11px;">(${r.date})</span>
          </div>
          <div style="font-weight: 800;" class="${valClass}">
            ${formatWon(r.amount)}
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // 장부 목록 렌더링 및 필터링
  // ==========================================================================
  function renderLedger() {
    const tbody = document.getElementById('ledgerTableBody');
    const searchVal = document.getElementById('filterSearch').value.trim().toLowerCase();
    const typeVal = document.getElementById('filterType').value;
    const catVal = document.getElementById('filterCategory').value;
    const groupVal = document.getElementById('filterGroup').value;

    let filtered = state.records.filter(r => {
      if (typeVal !== 'all' && r.type !== typeVal) return false;
      if (catVal !== 'all' && r.category !== catVal) return false;
      if (groupVal !== 'all' && r.group !== groupVal) return false;
      if (searchVal) {
        const text = `${r.name} ${r.phone} ${r.eventName} ${r.memo || ''}`.toLowerCase();
        if (!text.includes(searchVal)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    let sumGive = 0;
    let sumTake = 0;
    filtered.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'give') sumGive += amt;
      else sumTake += amt;
    });

    document.getElementById('filterResultCount').textContent = filtered.length;
    document.getElementById('filterGiveSum').textContent = formatWon(sumGive);
    document.getElementById('filterTakeSum').textContent = formatWon(sumTake);
    
    const balDiff = sumTake - sumGive;
    const balEl = document.getElementById('filterBalanceSum');
    balEl.textContent = (balDiff >= 0 ? '+' : '-') + formatWon(Math.abs(balDiff));
    balEl.className = balDiff >= 0 ? 'val-jade' : 'val-vermilion';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 40px; color: var(--color-secondary);">해당 조건의 경조사 내역이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const isGive = r.type === 'give';
      const badge = isGive
        ? `<span class="badge-tag badge-give">보냄 (Give)</span>`
        : `<span class="badge-tag badge-take">받음 (Take)</span>`;
      const amountClass = isGive ? 'val-vermilion' : 'val-jade';

      const pumasiTag = r.isPumasi ? `<span class="tag-pumasi">품앗이</span>` : '';
      const sampleTag = r.isSample || (r.id && r.id.startsWith('rec_sample_')) ? `<span class="tag-pumasi" style="background:#F0F4FF; color:#3B82F6; border-color:#93C5FD;">샘플</span>` : '';
      const thankedBadge = r.isThanked
        ? `<span style="color: var(--color-jade); font-weight:700; font-size:11px;">✓ 완료</span>`
        : `<span style="color: var(--color-secondary); font-size:11px;">-</span>`;

      return `
        <tr>
          <td style="white-space: nowrap;">${r.date}</td>
          <td>${badge}</td>
          <td>
            <strong style="cursor: pointer; color: var(--color-navy);" onclick="openContactTimeline('${r.phone || r.name}')">${escapeHtml(r.name)}</strong>
            ${pumasiTag}
            ${sampleTag}
          </td>
          <td style="font-size: 12px; color: var(--color-secondary); font-family: monospace;">${escapeHtml(r.phone)}</td>
          <td><span class="badge-tag badge-category">${escapeHtml(r.group)}</span></td>
          <td><strong>${escapeHtml(r.eventName)}</strong></td>
          <td>${escapeHtml(r.category)}</td>
          <td><strong class="${amountClass}">${formatWon(r.amount)}</strong></td>
          <td style="font-size: 12px;">${escapeHtml(r.attendance || '-')}</td>
          <td>${thankedBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-outline" style="padding: 3px 8px; font-size: 11px;" onclick="editRecord('${r.id}')">수정</button>
            <button type="button" class="btn btn-outline" style="padding: 3px 8px; font-size: 11px; color: var(--color-vermilion);" onclick="deleteRecord('${r.id}')">삭제</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // 인맥별 타임라인 원장 렌더링
  // ==========================================================================
  function renderContacts() {
    const grid = document.getElementById('contactGrid');
    const searchVal = document.getElementById('contactSearch').value.trim().toLowerCase();
    const groupVal = document.getElementById('contactGroupFilter').value;

    const contactMap = {};

    // 1. 단독 등록된 인맥 먼저 반영
    (state.contacts || []).forEach(c => {
      const key = c.phone || c.name;
      if (!contactMap[key]) {
        contactMap[key] = {
          key: key,
          name: c.name,
          phone: c.phone,
          group: c.group || '기타',
          memo: c.memo || '',
          give: 0,
          take: 0,
          count: 0,
          events: []
        };
      }
    });

    // 2. 장부 거래 내역 매핑
    state.records.forEach(r => {
      const key = r.phone || r.name;
      if (!contactMap[key]) {
        contactMap[key] = {
          key: key,
          name: r.name,
          phone: r.phone,
          group: r.group,
          memo: '',
          give: 0,
          take: 0,
          count: 0,
          events: []
        };
      }
      const amt = Number(r.amount) || 0;
      if (r.type === 'give') contactMap[key].give += amt;
      else contactMap[key].take += amt;
      contactMap[key].count++;
      contactMap[key].events.push(r);
    });

    let contacts = Object.values(contactMap).filter(c => {
      if (groupVal !== 'all' && c.group !== groupVal) return false;
      if (searchVal) {
        const text = `${c.name} ${c.phone} ${c.memo || ''}`.toLowerCase();
        if (!text.includes(searchVal)) return false;
      }
      return true;
    });

    contacts.sort((a, b) => b.count - a.count);

    if (contacts.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--color-secondary);">해당 조건의 인맥이 없습니다. [인맥 대량 업로드]로 엑셀 지인 명단을 등록해보세요.</div>`;
      return;
    }

    grid.innerHTML = contacts.map(c => {
      const net = c.take - c.give;
      const netTag = net > 0
        ? `<span class="badge-tag badge-take">받은 돈 +${formatWon(net)}</span>`
        : net < 0
        ? `<span class="badge-tag badge-give">준 돈 +${formatWon(Math.abs(net))}</span>`
        : `<span class="badge-tag badge-category">수지 균형 (0원)</span>`;

      return `
        <div class="contact-card" onclick="openContactTimeline('${c.key}')">
          <div class="contact-header">
            <div class="contact-name-row">
              <span class="contact-name">${escapeHtml(c.name)}</span>
              <span class="badge-tag badge-category">${escapeHtml(c.group)}</span>
            </div>
            <span style="font-size: 11px; font-weight:700; color: var(--color-amber);">교류 ${c.count}건</span>
          </div>

          <div class="contact-phone">📞 ${escapeHtml(c.phone || '연락처 미등록')}</div>
          ${c.memo ? `<div style="font-size: 11px; color: var(--color-secondary); margin-top: 4px;">📝 ${escapeHtml(c.memo)}</div>` : ''}

          <div class="contact-balance-box">
            <div style="font-size: 11px;">
              <div>보냄: <strong class="val-vermilion">${formatWon(c.give)}</strong></div>
              <div>받음: <strong class="val-jade">${formatWon(c.take)}</strong></div>
            </div>
            <div>${netTag}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 인맥별 타임라인 모달 열기
  window.openContactTimeline = function (key) {
    const contact = (state.contacts || []).find(c => (c.phone || c.name) === key);
    const filtered = state.records.filter(r => (r.phone || r.name) === key);

    const personName = filtered.length > 0 ? filtered[0].name : (contact ? contact.name : key);
    const personPhone = filtered.length > 0 ? filtered[0].phone : (contact ? contact.phone : '');
    const personGroup = filtered.length > 0 ? filtered[0].group : (contact ? contact.group : '기타');
    const personMemo = contact ? contact.memo : '';

    let sumGive = 0;
    let sumTake = 0;
    filtered.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'give') sumGive += amt;
      else sumTake += amt;
    });

    const net = sumTake - sumGive;
    document.getElementById('timelineModalName').textContent = `${personName} 님의 경조사 타임라인`;

    document.getElementById('timelineModalSummary').innerHTML = `
      <div>
        <strong>소속:</strong> ${escapeHtml(personGroup)} | <strong>연락처:</strong> ${escapeHtml(personPhone || '미등록')}
        ${personMemo ? ` | <strong>메모:</strong> ${escapeHtml(personMemo)}` : ''}
      </div>
      <div>
        <span class="val-vermilion">보냄 ${formatWon(sumGive)}</span> / 
        <span class="val-jade">받음 ${formatWon(sumTake)}</span>
        (순수지: <strong>${net >= 0 ? '+' : '-'}${formatWon(Math.abs(net))}</strong>)
      </div>
    `;

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    const container = document.getElementById('timelineContainer');
    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 24px; color:var(--color-secondary);">아직 주고받은 경조사 내역이 없습니다. [새 내역 기록]으로 첫 거래를 추가해보세요!</div>`;
    } else {
      container.innerHTML = filtered.map(r => {
        const isGive = r.type === 'give';
        const dotClass = isGive ? 'dot-give' : 'dot-take';
        const label = isGive ? '내가 보냄' : '내가 받음';
        const amountClass = isGive ? 'val-vermilion' : 'val-jade';

        return `
          <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-box">
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                <span style="font-weight:700; color:var(--color-navy);">${r.date}</span>
                <span class="badge-tag ${isGive ? 'badge-give' : 'badge-take'}">${label}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:14px;">${escapeHtml(r.eventName)} (${escapeHtml(r.category)})</strong>
                <strong class="${amountClass}" style="font-size:15px;">${formatWon(r.amount)}</strong>
              </div>
              ${r.memo ? `<div style="font-size:11px; color:var(--color-secondary); margin-top:4px;">메모: ${escapeHtml(r.memo)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('contactTimelineModal').classList.add('active');
  };

  // ==========================================================================
  // 경조사 신규 등록 및 편집 모달 제어
  // ==========================================================================
  function openRecordModal(record = null) {
    const modal = document.getElementById('recordModal');
    const form = document.getElementById('recordForm');
    form.reset();

    const btnGive = document.getElementById('btnTypeGive');
    const btnTake = document.getElementById('btnTypeTake');

    if (record) {
      document.getElementById('recordModalTitle').textContent = '경조사 내역 수정';
      document.getElementById('recordId').value = record.id;
      document.getElementById('formType').value = record.type;
      document.getElementById('formDate').value = record.date;
      document.getElementById('formCategory').value = record.category;
      document.getElementById('formName').value = record.name;
      document.getElementById('formPhone').value = record.phone;
      document.getElementById('formGroup').value = record.group;
      document.getElementById('formEventName').value = record.eventName;
      document.getElementById('formAmount').value = record.amount;
      document.getElementById('formAttendance').value = record.attendance || '참석(식사)';
      document.getElementById('formIsPumasi').checked = !!record.isPumasi;
      document.getElementById('formIsThanked').checked = !!record.isThanked;
      document.getElementById('formMemo').value = record.memo || '';

      if (record.type === 'give') {
        btnGive.className = 'type-toggle-btn active-give';
        btnTake.className = 'type-toggle-btn';
      } else {
        btnGive.className = 'type-toggle-btn';
        btnTake.className = 'type-toggle-btn active-take';
      }
    } else {
      document.getElementById('recordModalTitle').textContent = '경조사 내역 등록';
      document.getElementById('recordId').value = '';
      document.getElementById('formType').value = 'give';
      document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
      btnGive.className = 'type-toggle-btn active-give';
      btnTake.className = 'type-toggle-btn';
    }

    modal.classList.add('active');
  }

  function closeRecordModal() {
    document.getElementById('recordModal').classList.remove('active');
  }

  window.editRecord = function (id) {
    const record = state.records.find(r => r.id === id);
    if (record) openRecordModal(record);
  };

  window.deleteRecord = async function (id) {
    const record = state.records.find(r => r.id === id);
    if (!record) return;

    const ok = await AppModal.confirm(
      '내역 삭제 확인',
      `[${record.name} - ${record.eventName} (${formatWon(record.amount)})]\n내역을 정말 삭제하시겠습니까?`,
      { danger: true, okText: '삭제', stamp: '廢棄' }
    );

    if (ok) {
      state.records = state.records.filter(r => r.id !== id);
      saveRecords();
      showToast('경조사 내역이 삭제되었습니다.');
    }
  };

  // ==========================================================================
  // 적정 부조금 눈치 계산기
  // ==========================================================================
  function runCalculator() {
    const relation = document.getElementById('calcRelation').value;
    const attendance = document.getElementById('calcAttendance').value;
    const venue = document.getElementById('calcVenue').value;
    const pastGiven = Number(document.getElementById('calcPastGiven').value) || 0;

    let baseAmount = 100000;
    const adviceList = [];

    if (pastGiven > 0) {
      baseAmount = pastGiven;
      adviceList.push(`과거 상대방이 내게 주었던 금액(${formatWon(pastGiven)})을 기본 원칙으로 책정합니다.`);
      if (attendance === 'attend_eat' && venue === 'hotel' && baseAmount < 150000) {
        baseAmount = Math.max(baseAmount, 150000);
        adviceList.push(`특급 호텔 식대(10~15만원선)를 감안하여 최소 15만원 이상으로 보정했습니다.`);
      }
    } else {
      switch (relation) {
        case 'best_friend':
          baseAmount = 200000;
          adviceList.push('매우 돈독한 절친/베프이므로 기본 20~30만원 선이 권장됩니다.');
          break;
        case 'friend':
          baseAmount = 100000;
          adviceList.push('일반 친구 및 전 직장 동료는 10만원이 가장 대중적인 기준입니다.');
          break;
        case 'work_close':
          baseAmount = 100000;
          adviceList.push('현 직장 팀원/사수는 10만원이 표준이며, 친밀도에 따라 15만원도 추천합니다.');
          break;
        case 'work_normal':
          baseAmount = 50000;
          adviceList.push('다른 부서 동료나 가끔 마주치는 사이는 5만원 또는 불참 5만원선입니다.');
          break;
        case 'relative_close':
          baseAmount = 300000;
          adviceList.push('가까운 친척(사촌/이모/삼촌)은 30~50만원이 기본 예의선입니다.');
          break;
        case 'relative_far':
          baseAmount = 100000;
          adviceList.push('먼 친척은 10~20만원 선에서 조율합니다.');
          break;
        case 'acquaintance':
          baseAmount = 50000;
          adviceList.push('오랜만에 연락 온 지인은 불참 5만원 혹은 안 가도 무방한 수준입니다.');
          break;
      }
    }

    if (attendance === 'no_attend') {
      if (baseAmount >= 100000 && pastGiven === 0) {
        baseAmount = Math.max(50000, baseAmount - 50000);
      }
      adviceList.push('불참 시에는 식대를 지출하지 않으므로 마음을 담아 5~10만원 송금합니다.');
    } else if (attendance === 'attend_family') {
      baseAmount += 100000;
      adviceList.push('동반 2인 이상 식사 시 웨딩홀 식대 부담을 줄이기 위해 +10만원을 가산했습니다.');
    } else if (attendance === 'attend_no_eat') {
      adviceList.push('직접 참석하여 인사만 나누고 식사를 하지 않으실 경우 5~10만원선이 좋습니다.');
    }

    if (venue === 'hotel' && attendance === 'attend_eat') {
      if (baseAmount < 150000) baseAmount = 150000;
      adviceList.push('특급 호텔 웨딩은 1인당 식대가 10~15만원을 초과하므로 15만원 이상을 권장합니다.');
    }

    baseAmount = Math.round(baseAmount / 10000) * 10000;

    document.getElementById('calcResultAmount').textContent = formatWon(baseAmount);
    document.getElementById('calcSummaryBadge').textContent = `(기준 산정액: ${formatWon(baseAmount)})`;

    const adviceUl = document.getElementById('calcAdviceList');
    adviceUl.innerHTML = adviceList.map(a => `<li>${a}</li>`).join('');

    if (typeof window.fireBigCelebration === 'function') {
      window.fireBigCelebration();
    }
  }

  // ==========================================================================
  // 순수 엑셀(XLSX) 양식 다운로드 & 대량 업로드 (SheetJS 기반 무손실 처리)
  // ==========================================================================

  // 1. 장부 엑셀(XLSX) 표준 양식 다운로드
  function downloadLedgerTemplateXLSX() {
    const headers = ['일자', '구분', '성명', '연락처', '그룹', '행사명', '분류', '금액', '참석여부', '품앗이', '답례감사', '메모'];
    const sampleRows = [
      ['2025-05-18', '받음', '이민호', '010-3456-7890', '직장', '내 결혼식 축의금', '축의', 200000, '참석(식사)', 'N', 'Y', '회사 사수'],
      ['2024-03-10', '보냄', '이민호', '010-3456-7890', '직장', '사수 첫째 돌잔치', '축의', 100000, '참석(식사)', 'N', 'Y', '선물 별도 전달'],
      ['2025-01-15', '보냄', '정우성', '010-5544-3322', '직장', '부친상 조의금', '조의', 100000, '참석(식사)', 'N', 'Y', '서울성모 장례식장']
    ];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 15 },
        { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
        { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '경조사장부_양식');
      XLSX.writeFile(wb, '기부태익_장부등록_양식.xlsx');
    } else {
      // 폴백 CSV
      const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
      downloadFile(csvContent, '기부태익_장부등록_양식.csv', 'text/csv;charset=utf-8;');
    }
    showToast('📥 엑셀(XLSX) 장부 등록 양식이 다운로드되었습니다.', 'success');
  }

  // 2. 장부 엑셀(XLSX) 대량 업로드
  function uploadLedgerExcel(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let rows = [];
        if (typeof XLSX !== 'undefined') {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        } else {
          // CSV 파서 폴백
          const text = new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
          const parsed = parseCSV(text);
          if (parsed) rows = [parsed.headers, ...parsed.rows];
        }

        if (!rows || rows.length < 2) {
          throw new Error('파일에 데이터 행이 존재하지 않습니다.');
        }

        const newRecords = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[2]) continue; // 성명 필수

          const rawDate = row[0] ? String(row[0]).trim() : new Date().toISOString().split('T')[0];
          const rawType = String(row[1] || '').trim();
          const isGive = rawType.includes('보냄') || rawType.toLowerCase() === 'give';

          const name = String(row[2]).trim();
          const phone = String(row[3] || '').trim();
          const group = String(row[4] || '기타').trim();
          const eventName = String(row[5] || '경조사').trim();
          const category = String(row[6] || '축의').trim();
          const rawAmount = String(row[7] || '0').replace(/[^0-9]/g, '');
          const amount = Number(rawAmount) || 0;
          const attendance = String(row[8] || '참석(식사)').trim();
          const rawPumasi = String(row[9] || '').toUpperCase();
          const isPumasi = rawPumasi.includes('Y') || rawPumasi.includes('1') || rawPumasi.includes('예');
          const rawThanked = String(row[10] || '').toUpperCase();
          const isThanked = rawThanked.includes('Y') || rawThanked.includes('1') || rawThanked.includes('완료');
          const memo = String(row[11] || '').trim();

          newRecords.push({
            id: 'rec_excel_' + Date.now() + '_' + i,
            type: isGive ? 'give' : 'take',
            date: rawDate,
            category: category,
            name: name,
            phone: phone,
            group: group,
            eventName: eventName,
            amount: amount,
            attendance: attendance,
            isPumasi: isPumasi,
            isThanked: isThanked,
            memo: memo
          });
        }

        if (newRecords.length === 0) {
          throw new Error('유효한 경조사 데이터 행을 찾을 수 없습니다.');
        }

        const ok = await AppModal.confirm(
          '장부 엑셀(XLSX) 대량 등록',
          `파일에서 총 ${newRecords.length}건의 경조사 내역을 읽었습니다.\n기존 장부에 추가(병합)하시겠습니까?`,
          { okText: '등록하기', stamp: '登錄' }
        );

        if (ok) {
          state.records = [...newRecords, ...state.records];
          saveRecords();
          if (typeof window.fireBigCelebration === 'function') {
            window.fireBigCelebration();
          }
          showToast(`🎉 총 ${newRecords.length}건의 경조사 내역이 엑셀에서 대량 등록되었습니다!`, 'success');
        }
      } catch (err) {
        AppModal.alert('엑셀 업로드 실패', '엑셀 파일을 분석하는 중 오류가 발생했습니다: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 3. 인맥 엑셀(XLSX) 샘플 양식 다운로드
  function downloadContactTemplateXLSX() {
    const headers = ['성명', '연락처', '소속그룹', '메모'];
    const sampleRows = [
      ['홍길동', '010-1234-5678', '직장', '기획팀 동료'],
      ['김영희', '010-9876-5432', '친구', '고등학교 동창'],
      ['박철수', '010-5555-4444', '친척', '사촌 형']
    ];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '인맥_양식');
      XLSX.writeFile(wb, '기부태익_인맥등록_양식.xlsx');
    } else {
      const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
      downloadFile(csvContent, '기부태익_인맥등록_양식.csv', 'text/csv;charset=utf-8;');
    }
    showToast('📥 인맥 등록용 엑셀(XLSX) 샘플 양식이 다운로드되었습니다.', 'success');
  }

  // 4. 인맥 엑셀(XLSX) 대량 업로드
  function uploadContactExcel(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let rows = [];
        if (typeof XLSX !== 'undefined') {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        } else {
          const text = new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
          const parsed = parseCSV(text);
          if (parsed) rows = [parsed.headers, ...parsed.rows];
        }

        if (!rows || rows.length < 2) {
          throw new Error('파일에 데이터 행이 존재하지 않습니다.');
        }

        const newContacts = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[0]) continue; // 성명 필수

          const name = String(row[0]).trim();
          const phone = String(row[1] || '').trim();
          const group = String(row[2] || '기타').trim();
          const memo = String(row[3] || '').trim();

          newContacts.push({ name, phone, group, memo });
        }

        if (newContacts.length === 0) {
          throw new Error('유효한 인맥 데이터 행을 찾을 수 없습니다.');
        }

        const ok = await AppModal.confirm(
          '인맥 엑셀(XLSX) 대량 등록',
          `파일에서 총 ${newContacts.length}명의 지인 명단을 읽었습니다.\n인맥 장부에 등록(병합)하시겠습니까?`,
          { okText: '등록하기', stamp: '人脈' }
        );

        if (ok) {
          const existingMap = {};
          (state.contacts || []).forEach(c => {
            existingMap[c.phone || c.name] = c;
          });

          newContacts.forEach(nc => {
            const key = nc.phone || nc.name;
            existingMap[key] = nc;
          });

          state.contacts = Object.values(existingMap);
          saveRecords();

          if (typeof window.fireBigCelebration === 'function') {
            window.fireBigCelebration();
          }
          showToast(`👥 총 ${newContacts.length}명의 지인이 인맥 장부에 등록되었습니다!`, 'success');
        }
      } catch (err) {
        AppModal.alert('인맥 업로드 실패', '엑셀 파일을 분석하는 중 오류가 발생했습니다: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 5. 현재 장부 엑셀(XLSX) 저장
  function exportExcel() {
    if (state.records.length === 0) {
      showToast('내보낼 장부 데이터가 없습니다.', 'warn');
      return;
    }

    const headers = ['일자', '구분', '성명', '연락처', '그룹', '행사명', '분류', '금액', '참석여부', '품앗이여부', '답례감사여부', '메모'];
    const rows = state.records.map(r => [
      r.date,
      r.type === 'give' ? '보냄(Give)' : '받음(Take)',
      r.name,
      r.phone,
      r.group,
      r.eventName,
      r.category,
      Number(r.amount) || 0,
      r.attendance || '',
      r.isPumasi ? 'Y' : 'N',
      r.isThanked ? 'Y' : 'N',
      r.memo || ''
    ]);

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 },
        { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
        { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '경조사장부');
      XLSX.writeFile(wb, `기부태익_경조사장부_${getTodayDateString()}.xlsx`);
      showToast('📥 엑셀(XLSX) 장부 파일이 저장되었습니다.', 'success');
    } else {
      exportCSV();
    }
  }

  // 6. CSV 폴백 내보내기
  function exportCSV() {
    if (state.records.length === 0) {
      showToast('내보낼 장부 데이터가 없습니다.', 'warn');
      return;
    }

    const headers = ['일자', '구분', '성명', '연락처', '그룹', '행사명', '분류', '금액', '참석여부', '품앗이여부', '답례감사여부', '메모'];
    const rows = state.records.map(r => [
      `"${r.date}"`,
      `"${r.type === 'give' ? '보냄(Give)' : '받음(Take)'}"`,
      `"${r.name}"`,
      `"${r.phone}"`,
      `"${r.group}"`,
      `"${r.eventName}"`,
      `"${r.category}"`,
      r.amount,
      `"${r.attendance || ''}"`,
      `"${r.isPumasi ? 'Y' : 'N'}"`,
      `"${r.isThanked ? 'Y' : 'N'}"`,
      `"${(r.memo || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    downloadFile(csvContent, `기부태익_경조사장부_${getTodayDateString()}.csv`, 'text/csv;charset=utf-8;');
    showToast('📥 엑셀(CSV) 장부 파일이 다운로드되었습니다.', 'success');
  }

  // CSV 파서 유틸리티 (폴백용)
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return null;

    function parseLine(line) {
      const row = [];
      let insideQuote = false;
      let entry = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (insideQuote && line[i + 1] === '"') {
            entry += '"';
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (c === ',' && !insideQuote) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += c;
        }
      }
      row.push(entry.trim());
      return row;
    }

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length > 0 && values.some(v => v.length > 0)) {
        rows.push(values);
      }
    }
    return { headers, rows };
  }

  // ==========================================================================
  // 데이터 관리 & 무서버 동기화 (QR / JSON / Wipe)
  // ==========================================================================

  // 1. JSON 전체 백업
  function exportJSON() {
    const backupData = {
      app: '기부태익 (期赴泰益)',
      version: '1.00',
      exportedAt: new Date().toISOString(),
      recordCount: state.records.length,
      records: state.records,
      contacts: state.contacts
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    downloadFile(jsonStr, `기부태익_백업_v1.00_${getTodayDateString()}.json`, 'application/json');
    showToast('💾 안전 백업 JSON 파일이 다운로드되었습니다.', 'success');
  }

  // 2. JSON 복원
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const importedRecords = Array.isArray(data) ? data : (data.records || []);
        const importedContacts = data.contacts || [];

        if (!Array.isArray(importedRecords)) {
          throw new Error('유효하지 않은 장부 파일 형식입니다.');
        }

        const ok = await AppModal.confirm(
          '백업 파일 복원',
          `가져올 내역: 총 ${importedRecords.length}건, 인맥: ${importedContacts.length}명\n기존 데이터를 덮어쓰고 복원하시겠습니까?`,
          { okText: '복원하기', stamp: '復元' }
        );

        if (ok) {
          state.records = importedRecords;
          state.contacts = importedContacts;
          saveRecords();
          if (typeof window.fireBigCelebration === 'function') {
            window.fireBigCelebration();
          }
          showToast(`🎉 총 ${importedRecords.length}건의 장부가 복원되었습니다!`, 'success');
        }
      } catch (err) {
        AppModal.alert('복원 실패', '파일을 읽는 중 오류가 발생했습니다: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // 스마트 링크 QR & 공무원 행정망 맞춤 무서버 동기화 로직
  // ==========================================================================

  function getSyncBaseUrl() {
    const defaultProdUrl = 'https://give-take.vercel.app/';
    if (typeof window === 'undefined') return defaultProdUrl;
    const href = window.location.href;
    if (href.startsWith('file:') || href.includes('127.0.0.1') || href.includes('localhost')) {
      return defaultProdUrl;
    }
    return window.location.origin + window.location.pathname;
  }

  function getRecordsByScope(scope) {
    if (scope === 'all') return state.records;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (scope === 'today') {
      return state.records.filter(r => r.date === todayStr);
    }

    if (scope === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`;
      return state.records.filter(r => r.date >= weekAgoStr);
    }

    if (scope === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const monthAgoStr = `${monthAgo.getFullYear()}-${pad(monthAgo.getMonth() + 1)}-${pad(monthAgo.getDate())}`;
      return state.records.filter(r => r.date >= monthAgoStr);
    }

    return state.records;
  }

  function getScopeLabel(scope) {
    switch (scope) {
      case 'today': return '오늘 작성분';
      case 'week': return '최근 7일 작성분';
      case 'month': return '최근 30일 작성분';
      default: return '전체 장부';
    }
  }

  // 1. 스마트 링크 QR 코드 생성 (PC ➡️ 모바일)
  function showSyncQR() {
    if (state.records.length === 0) {
      showToast('동기화할 장부 내역이 없습니다.', 'warn');
      return;
    }

    const scopeSelect = document.getElementById('qrScopeSelect');
    const scope = scopeSelect ? scopeSelect.value : 'week';
    generateSyncQRPages(scope);

    document.getElementById('qrModalTitle').textContent = '스마트 링크 동기화 QR (PC ➡️ 모바일)';
    document.getElementById('qrModal').classList.add('active');
  }

  function generateSyncQRPages(scope) {
    let targetRecords = getRecordsByScope(scope);

    if (targetRecords.length === 0) {
      showToast(`해당 기간(${getScopeLabel(scope)})에 등록된 내역이 없어 전체 장부로 전환합니다.`, 'info');
      targetRecords = state.records;
      const scopeSelect = document.getElementById('qrScopeSelect');
      if (scopeSelect) scopeSelect.value = 'all';
    }

    const baseUrl = getSyncBaseUrl();
    const CHUNK_SIZE = 15; // 모바일 카메라가 0.1초 만에 인식할 수 있도록 최적화
    const totalPages = Math.ceil(targetRecords.length / CHUNK_SIZE);
    state.qrPages = [];

    for (let p = 0; p < totalPages; p++) {
      const chunk = targetRecords.slice(p * CHUNK_SIZE, (p + 1) * CHUNK_SIZE);
      const lines = chunk.map(r => [
        r.date || '',
        r.type === 'give' ? '0' : '1',
        r.category || '축의',
        (r.name || '').replace(/[\|\n]/g, ' '),
        (r.phone || '').replace(/[\|\n]/g, ' '),
        (r.group || '').replace(/[\|\n]/g, ' '),
        (r.eventName || '').replace(/[\|\n]/g, ' '),
        r.amount || 0,
        (r.attendance || '').replace(/[\|\n]/g, ' '),
        r.isPumasi ? '1' : '0',
        r.isThanked ? '1' : '0',
        (r.memo || '').replace(/[\|\n]/g, ' ')
      ].join('|'));

      const rawData = lines.join('\n');
      const base64Data = btoa(unescape(encodeURIComponent(rawData)));
      const smartUrl = `${baseUrl}#sync=${base64Data}`;

      state.qrPages.push({
        url: smartUrl,
        raw: rawData,
        count: chunk.length,
        page: p + 1,
        totalPages: totalPages
      });
    }

    state.qrCurrentPageIndex = 0;
    renderQrPage(0);
  }

  function renderQrPage(index) {
    if (!state.qrPages || index < 0 || index >= state.qrPages.length) return;
    state.qrCurrentPageIndex = index;

    const pageData = state.qrPages[index];
    const qr = qrcode(0, 'L');
    qr.addData(pageData.url);
    qr.make();

    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = qr.createSvgTag(4, 6);

    const paginationEl = document.getElementById('qrPaginationControls');
    const indicatorEl = document.getElementById('qrPageIndicator');
    const btnPrev = document.getElementById('btnQrPrevPage');
    const btnNext = document.getElementById('btnQrNextPage');

    if (state.qrPages.length > 1) {
      paginationEl.style.display = 'flex';
      indicatorEl.textContent = `${index + 1} / ${state.qrPages.length} 장 (${pageData.count}건)`;
      if (btnPrev) btnPrev.disabled = index === 0;
      if (btnNext) btnNext.disabled = index === state.qrPages.length - 1;
    } else {
      paginationEl.style.display = 'none';
    }
  }

  function copySyncLink() {
    if (!state.qrPages || !state.qrPages[state.qrCurrentPageIndex]) {
      showToast('동기화할 링크가 없습니다.', 'warn');
      return;
    }
    const url = state.qrPages[state.qrCurrentPageIndex].url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('🔗 스마트폰 동기화 웹 링크가 복사되었습니다!');
      }).catch(() => {
        prompt('동기화 링크를 복사하세요:', url);
      });
    } else {
      prompt('동기화 링크를 복사하세요:', url);
    }
  }

  // 2. 공무원 행정망 모바일 동기화 코드 복사 (모바일 ➡️ PC)
  function copyMobileSyncText() {
    if (state.records.length === 0) {
      showToast('동기화할 장부 내역이 없습니다.', 'warn');
      return;
    }

    let target = getRecordsByScope('today');
    let label = '오늘 작성분';
    if (target.length === 0) {
      target = getRecordsByScope('week');
      label = '최근 7일 작성분';
    }
    if (target.length === 0) {
      target = state.records.slice(0, 20);
      label = '최신 20건';
    }

    const lines = target.map(r => [
      r.date || '',
      r.type === 'give' ? '0' : '1',
      r.category || '축의',
      (r.name || '').replace(/[\|\n]/g, ' '),
      (r.phone || '').replace(/[\|\n]/g, ' '),
      (r.group || '').replace(/[\|\n]/g, ' '),
      (r.eventName || '').replace(/[\|\n]/g, ' '),
      r.amount || 0,
      (r.attendance || '').replace(/[\|\n]/g, ' '),
      r.isPumasi ? '1' : '0',
      r.isThanked ? '1' : '0',
      (r.memo || '').replace(/[\|\n]/g, ' ')
    ].join('|'));

    const syncCode = `GNT3:${label}(${target.length}건):\n` + lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(syncCode).then(() => {
        AppModal.alert(
          '📋 동기화 코드 복사 완료',
          `[${label}] 총 ${target.length}건의 동기화 코드가 클립보드에 복사되었습니다!\n\n공직자통합메일(korea.kr) 또는 상용메일 본문에 붙여넣어 본인에게 전송한 후, 행정망 PC에서 [PC에서 코드 붙여넣기]를 실행하세요.`,
          'success'
        );
      }).catch(() => {
        prompt('동기화 코드를 복사하세요:', syncCode);
      });
    } else {
      prompt('동기화 코드를 복사하세요:', syncCode);
    }
  }

  // 3. PC에서 텍스트 코드 붙여넣기 모달 & 적용
  function openPasteSyncModal() {
    const modal = document.getElementById('textSyncModal');
    const textarea = document.getElementById('syncTextarea');
    if (textarea) textarea.value = '';
    modal.classList.add('active');
    setTimeout(() => textarea?.focus(), 150);
  }

  function closePasteSyncModal() {
    document.getElementById('textSyncModal')?.classList.remove('active');
  }

  function parseSyncTextLines(raw) {
    let recordsToRestore = [];
    raw = (raw || '').trim();

    // 1. #sync= 뒤의 Base64인 경우
    if (raw.includes('#sync=')) {
      try {
        const b64 = raw.split('#sync=')[1].trim();
        raw = decodeURIComponent(escape(atob(b64)));
      } catch (e) {}
    } else if (!raw.startsWith('GNT') && !raw.startsWith('{') && !raw.startsWith('[')) {
      try {
        const decoded = decodeURIComponent(escape(atob(raw)));
        if (decoded.includes('|')) raw = decoded;
      } catch (e) {}
    }

    // 2. GNT3 파이프 구분자 포맷
    if (raw.includes('|')) {
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('GNT3:')) continue;
        const parts = line.split('|');
        if (parts.length >= 8) {
          recordsToRestore.push({
            id: 'rec_sync_' + Date.now() + '_' + i,
            date: parts[0],
            type: parts[1] === '0' ? 'give' : 'take',
            category: parts[2],
            name: parts[3],
            phone: parts[4],
            group: parts[5],
            eventName: parts[6],
            amount: Number(parts[7]) || 0,
            attendance: parts[8] || '참석(식사)',
            isPumasi: parts[9] === '1',
            isThanked: parts[10] === '1',
            memo: parts[11] || ''
          });
        }
      }
    } else if (raw.startsWith('GNT:')) {
      const compact = JSON.parse(raw.substring(4));
      recordsToRestore = compact.map((c, idx) => ({
        id: 'rec_sync_' + Date.now() + '_' + idx,
        type: c.t === 0 ? 'give' : 'take',
        date: c.d,
        category: c.c,
        name: c.n,
        phone: c.p,
        group: c.g,
        eventName: c.e,
        amount: c.a,
        attendance: c.at,
        isPumasi: !!c.pu,
        isThanked: !!c.th,
        memo: c.m
      }));
    } else if (raw.startsWith('{') || raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      recordsToRestore = Array.isArray(parsed) ? parsed : (parsed.records || []);
    }

    return recordsToRestore;
  }

  async function applySyncText() {
    const textarea = document.getElementById('syncTextarea');
    const raw = textarea ? textarea.value.trim() : '';
    if (!raw) {
      showToast('동기화 코드를 입력해 주세요.', 'warn');
      return;
    }

    try {
      const records = parseSyncTextLines(raw);
      if (!records || records.length === 0) {
        throw new Error('유효한 장부 데이터가 포함되어 있지 않습니다.');
      }

      let addedCount = 0;
      records.forEach(newR => {
        const isDuplicate = state.records.some(r =>
          r.date === newR.date &&
          r.name === newR.name &&
          r.amount === newR.amount &&
          r.eventName === newR.eventName &&
          r.type === newR.type
        );
        if (!isDuplicate) {
          state.records.unshift(newR);
          addedCount++;
        }
      });

      saveRecords();
      refreshAllViews();
      closePasteSyncModal();

      if (typeof window.fireBigCelebration === 'function') {
        window.fireBigCelebration();
      }
      showToast(`🎉 총 ${addedCount}건의 새로운 내역이 장부에 반영되었습니다! (중복 ${records.length - addedCount}건 제외)`, 'success');
    } catch (err) {
      AppModal.alert('동기화 반영 실패', '동기화 코드를 해석할 수 없습니다: ' + err.message, 'error');
    }
  }

  // 4. 최근 작성분만 엑셀 저장 (.xlsx)
  function exportRecentXLSX() {
    let target = getRecordsByScope('week');
    let label = '최근7일';
    if (target.length === 0) {
      target = state.records;
      label = '전체';
    }

    if (target.length === 0) {
      showToast('내보낼 장부 내역이 없습니다.', 'warn');
      return;
    }

    const exportData = target.map(r => ({
      '일자': r.date || '',
      '구분': r.type === 'give' ? '보냄(출)' : '받음(입)',
      '행사분류': r.category || '',
      '성명': r.name || '',
      '연락처': r.phone || '',
      '소속그룹': r.group || '',
      '행사명': r.eventName || '',
      '금액': Number(r.amount) || 0,
      '참석여부': r.attendance || '',
      '부모님품앗이': r.isPumasi ? 'Y' : 'N',
      '답례완료': r.isThanked ? 'Y' : 'N',
      '비고메모': r.memo || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
      { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '최근경조사');
    XLSX.writeFile(workbook, `기부태익_${label}_경조사장부_${getTodayDateString()}.xlsx`);
    showToast(`📊 ${label} 내역 ${target.length}건이 엑셀(.xlsx)로 저장되었습니다!`);
  }

  // 5. 모바일 접속 시 URL Hash 동기화 감지 (스마트폰 자동 반영)
  async function checkUrlHashSync() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('sync=')) return;

    try {
      const rawParam = hash.split('sync=')[1];
      if (!rawParam) return;

      const records = parseSyncTextLines(rawParam);
      if (!records || records.length === 0) return;

      setTimeout(async () => {
        const ok = await AppModal.confirm(
          '📱 스마트폰 장부 동기화',
          `PC에서 보낸 ${records.length}건의 장부 데이터가 도착했습니다!\n\n현재 내 스마트폰 장부에 추가하시겠습니까?`,
          { okText: '장부에 추가', cancelText: '취소', stamp: '同期' }
        );

        if (ok) {
          let addedCount = 0;
          records.forEach(newR => {
            const isDuplicate = state.records.some(r =>
              r.date === newR.date &&
              r.name === newR.name &&
              r.amount === newR.amount &&
              r.eventName === newR.eventName &&
              r.type === newR.type
            );
            if (!isDuplicate) {
              state.records.unshift(newR);
              addedCount++;
            }
          });

          saveRecords();
          refreshAllViews();
          if (typeof window.fireBigCelebration === 'function') {
            window.fireBigCelebration();
          }
          showToast(`🎉 총 ${addedCount}건이 스마트폰 장부에 성공적으로 추가되었습니다!`, 'success');
        }

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }, 600);
    } catch (err) {
      console.error('URL Hash Sync error:', err);
    }
  }

  // ==========================================================================
  // 6. 웹앱 내장 카메라 QR 스캐너 (Html5Qrcode 프로덕션급 하이브리드 엔진)
  // ==========================================================================
  let html5QrCodeScanner = null;

  async function startCameraScanner() {
    const modal = document.getElementById('cameraScanModal');
    const statusEl = document.getElementById('cameraScanStatus');

    modal.classList.add('active');
    if (statusEl) statusEl.textContent = '카메라 렌즈를 활성화하는 중...';

    // 기존 스캐너 안전 정리
    if (html5QrCodeScanner) {
      try {
        if (html5QrCodeScanner.isScanning) {
          await html5QrCodeScanner.stop();
        }
        html5QrCodeScanner.clear();
      } catch (e) {}
      html5QrCodeScanner = null;
    }

    try {
      if (typeof Html5Qrcode === 'undefined') {
        throw new Error('스캐너 엔진 라이브러리를 불러올 수 없습니다.');
      }

      html5QrCodeScanner = new Html5Qrcode("qrReader");

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(200, Math.floor(edge * 0.75));
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0
      };

      const qrSuccessCallback = (decodedText) => {
        if (statusEl) statusEl.textContent = '✨ QR 코드 인식 성공!';
        if (navigator.vibrate) navigator.vibrate(100);

        stopCameraScanner();
        handleScannedQRData(decodedText);
      };

      const qrErrorCallback = () => {
        // 프레임 탐색 중 (정상 동작)
      };

      // 1순위: 후면 카메라 (environment)
      try {
        await html5QrCodeScanner.start(
          { facingMode: "environment" },
          qrConfig,
          qrSuccessCallback,
          qrErrorCallback
        );
      } catch (camErr) {
        console.warn('FacingMode environment failed, trying fallback camera:', camErr);
        // 2순위: 기본 카메라 폴백
        await html5QrCodeScanner.start(
          {},
          qrConfig,
          qrSuccessCallback,
          qrErrorCallback
        );
      }

      if (statusEl) statusEl.textContent = '🔍 PC 모니터의 QR 코드를 사각형에 맞추세요.';
    } catch (err) {
      console.error('Camera Scanner start error:', err);
      stopCameraScanner();
      AppModal.alert(
        '카메라 권한 및 연결 오류',
        '카메라를 실행할 수 없습니다.\n[설정] > [Safari / Chrome]에서 카메라 접근이 허용되어 있는지 확인해 주세요.\n(오류 메시지: ' + err.message + ')',
        'error'
      );
    }
  }

  async function stopCameraScanner() {
    if (html5QrCodeScanner) {
      try {
        if (html5QrCodeScanner.isScanning) {
          await html5QrCodeScanner.stop();
        }
        html5QrCodeScanner.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      html5QrCodeScanner = null;
    }
    document.getElementById('cameraScanModal')?.classList.remove('active');
  }

  async function handleScannedQRData(rawContent) {
    try {
      const records = parseSyncTextLines(rawContent);
      if (!records || records.length === 0) {
        AppModal.alert('스캔 데이터 오류', '스캔한 QR 코드에 유효한 장부 데이터가 포함되어 있지 않습니다.', 'warn');
        return;
      }

      const ok = await AppModal.confirm(
        '📷 웹앱 실시간 동기화',
        `스캔 성공! 총 ${records.length}건의 장부 데이터가 확인되었습니다.\n\n현재 홈 화면 웹앱 장부에 즉시 반영하시겠습니까?`,
        { okText: '웹앱 장부에 추가', cancelText: '취소', stamp: '即時' }
      );

      if (ok) {
        let addedCount = 0;
        records.forEach(newR => {
          const isDuplicate = state.records.some(r =>
            r.date === newR.date &&
            r.name === newR.name &&
            r.amount === newR.amount &&
            r.eventName === newR.eventName &&
            r.type === newR.type
          );
          if (!isDuplicate) {
            state.records.unshift(newR);
            addedCount++;
          }
        });

        saveRecords();
        refreshAllViews();
        if (typeof window.fireBigCelebration === 'function') {
          window.fireBigCelebration();
        }
        showToast(`🎉 총 ${addedCount}건이 웹앱 장부에 성공적으로 저장되었습니다!`, 'success');
      }
    } catch (err) {
      AppModal.alert('동기화 오류', '장부 데이터 처리 중 오류: ' + err.message, 'error');
    }
  }

  // 7. 군사급 안심 완전 삭제 (Wipe)
  async function wipeAllData() {
    const firstOk = await AppModal.confirm(
      '⚠️ 데이터 영구 완전 삭제 1차 확인',
      '정말로 모든 장부 내역과 인맥 정보를 흔적 없이 영구 파괴하시겠습니까?\n이 작업은 절대 되돌릴 수 없습니다.',
      { danger: true, okText: '계속 진행', stamp: '警告' }
    );
    if (!firstOk) return;

    const secondOk = await AppModal.confirm(
      '🚨 최종 확인 (군사급 초기화)',
      '모든 금융 및 지인 데이터가 난수 덮어쓰기(Shredding) 후 완전 삭제됩니다.\n마지막으로 동의하십니까?',
      { danger: true, okText: '완전 영구 삭제', stamp: '破壞' }
    );
    if (!secondOk) return;

    const dummy = Array(5000).fill('0XFF_DESTROYED_SHRED_DATA').join('');
    localStorage.setItem(STORAGE_KEY, dummy);
    localStorage.setItem(CONTACTS_STORAGE_KEY, dummy);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CONTACTS_STORAGE_KEY);
    localStorage.clear();

    state.records = [];
    state.contacts = [];
    refreshAllViews();
    showToast('🗑️ 모든 장부 데이터가 영구히 완전 삭제되었습니다.', 'warn');
  }

  // ==========================================================================
  // 이벤트 리스너 등록
  // ==========================================================================
  function initEventListeners() {
    // 탭 전환
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        window.switchTab(targetTab);
      });
    });

    // 새 내역 추가 버튼
    document.getElementById('btnOpenNewRecord')?.addEventListener('click', () => openRecordModal());
    document.getElementById('btnRecordAddInTab')?.addEventListener('click', () => openRecordModal());

    // 샘플 불러오기 및 삭제 버튼
    document.getElementById('btnLoadSampleData')?.addEventListener('click', loadSampleData);
    document.getElementById('btnRemoveSampleData')?.addEventListener('click', removeSampleData);

    // 모달 닫기 버튼들
    document.getElementById('btnCancelRecordModal')?.addEventListener('click', closeRecordModal);
    document.getElementById('btnCloseTimeline')?.addEventListener('click', () => {
      document.getElementById('contactTimelineModal').classList.remove('active');
    });
    document.getElementById('btnCloseQRModal')?.addEventListener('click', () => {
      document.getElementById('qrModal').classList.remove('active');
    });

    // 보냄/받음 토글
    const btnGive = document.getElementById('btnTypeGive');
    const btnTake = document.getElementById('btnTypeTake');
    const formType = document.getElementById('formType');

    btnGive?.addEventListener('click', () => {
      formType.value = 'give';
      btnGive.className = 'type-toggle-btn active-give';
      btnTake.className = 'type-toggle-btn';
    });

    btnTake?.addEventListener('click', () => {
      formType.value = 'take';
      btnGive.className = 'type-toggle-btn';
      btnTake.className = 'type-toggle-btn active-take';
    });

    // 폼 저장
    document.getElementById('recordForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const recId = document.getElementById('recordId').value;
      const newRec = {
        id: recId || 'rec_' + Date.now(),
        type: formType.value,
        date: document.getElementById('formDate').value,
        category: document.getElementById('formCategory').value,
        name: document.getElementById('formName').value.trim(),
        phone: document.getElementById('formPhone').value.trim(),
        group: document.getElementById('formGroup').value,
        eventName: document.getElementById('formEventName').value.trim(),
        amount: Number(document.getElementById('formAmount').value) || 0,
        attendance: document.getElementById('formAttendance').value,
        isPumasi: document.getElementById('formIsPumasi').checked,
        isThanked: document.getElementById('formIsThanked').checked,
        memo: document.getElementById('formMemo').value.trim()
      };

      if (recId) {
        const idx = state.records.findIndex(r => r.id === recId);
        if (idx !== -1) state.records[idx] = newRec;
        showToast('경조사 내역이 수정되었습니다.', 'success');
      } else {
        state.records.unshift(newRec);
        if (typeof window.fireBigCelebration === 'function') {
          window.fireBigCelebration();
        }
        showToast('새 경조사 내역이 등록되었습니다!', 'success');
      }

      saveRecords();
      closeRecordModal();
    });

    // 랭킹 모드 토글
    document.getElementById('btnRankCreditor')?.addEventListener('click', () => {
      state.rankMode = 'creditor';
      renderDashboard();
    });
    document.getElementById('btnRankDebtor')?.addEventListener('click', () => {
      state.rankMode = 'debtor';
      renderDashboard();
    });

    // 필터 검색 변경
    document.getElementById('filterSearch')?.addEventListener('input', renderLedger);
    document.getElementById('filterType')?.addEventListener('change', renderLedger);
    document.getElementById('filterCategory')?.addEventListener('change', renderLedger);
    document.getElementById('filterGroup')?.addEventListener('change', renderLedger);

    // 인맥 검색 변경
    document.getElementById('contactSearch')?.addEventListener('input', renderContacts);
    document.getElementById('contactGroupFilter')?.addEventListener('change', renderContacts);

    // 장부 엑셀(XLSX) 양식 다운로드 & 업로드
    document.getElementById('btnDownloadLedgerTemplate')?.addEventListener('click', downloadLedgerTemplateXLSX);
    document.getElementById('btnUploadLedgerExcel')?.addEventListener('click', () => {
      document.getElementById('excelLedgerInput')?.click();
    });
    document.getElementById('excelLedgerInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadLedgerExcel(e.target.files[0]);
        e.target.value = '';
      }
    });
    document.getElementById('btnExportExcel')?.addEventListener('click', exportExcel);

    // 인맥 엑셀(XLSX) 양식 다운로드 & 업로드
    document.getElementById('btnDownloadContactTemplate')?.addEventListener('click', downloadContactTemplateXLSX);
    document.getElementById('btnUploadContactExcel')?.addEventListener('click', () => {
      document.getElementById('excelContactInput')?.click();
    });
    document.getElementById('excelContactInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadContactExcel(e.target.files[0]);
        e.target.value = '';
      }
    });

    // QR 페이징 버튼
    document.getElementById('btnQrPrevPage')?.addEventListener('click', () => {
      if (state.qrCurrentPageIndex > 0) {
        renderQrPage(state.qrCurrentPageIndex - 1);
      }
    });
    document.getElementById('btnQrNextPage')?.addEventListener('click', () => {
      if (state.qrCurrentPageIndex < state.qrPages.length - 1) {
        renderQrPage(state.qrCurrentPageIndex + 1);
      }
    });

    // 계산기 실행 버튼
    document.getElementById('btnRunCalc')?.addEventListener('click', runCalculator);

    // 데이터 관리 버튼들
    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('btnExportJSON')?.addEventListener('click', exportJSON);
    document.getElementById('btnImportJSON')?.addEventListener('click', () => {
      document.getElementById('jsonFileInput').click();
    });
    document.getElementById('jsonFileInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importJSON(e.target.files[0]);
        e.target.value = '';
      }
    });

    document.getElementById('btnShowSyncQR')?.addEventListener('click', showSyncQR);
    document.getElementById('qrScopeSelect')?.addEventListener('change', (e) => {
      generateSyncQRPages(e.target.value);
    });
    document.getElementById('btnCopySyncLink')?.addEventListener('click', copySyncLink);

    // 웹앱 내장 카메라 QR 스캐너 (PWA 홈 화면 바로가기용)
    document.getElementById('btnStartCameraScan')?.addEventListener('click', startCameraScanner);
    document.getElementById('btnCloseCameraScanModal')?.addEventListener('click', stopCameraScanner);
    document.getElementById('btnStopCameraScan')?.addEventListener('click', stopCameraScanner);

    document.getElementById('btnCopyMobileSyncText')?.addEventListener('click', copyMobileSyncText);
    document.getElementById('btnOpenPasteSyncModal')?.addEventListener('click', openPasteSyncModal);
    document.getElementById('btnCloseTextSyncModal')?.addEventListener('click', closePasteSyncModal);
    document.getElementById('btnCancelTextSync')?.addEventListener('click', closePasteSyncModal);
    document.getElementById('btnApplySyncText')?.addEventListener('click', applySyncText);

    document.getElementById('btnExportRecentXLSX')?.addEventListener('click', exportRecentXLSX);
    document.getElementById('btnWipeData')?.addEventListener('click', wipeAllData);

    // 은밀한 이스터에그 (Skill 2)
    document.getElementById('secretEasterEgg')?.addEventListener('click', () => {
      if (typeof window.fireBigCelebration === 'function') {
        window.fireBigCelebration();
      }
      showToast('💮 기부태익 (期赴泰益) v1.00 시스템 인증: 환영합니다!', 'success');
    });
  }

  // ==========================================================================
  // 전역 유틸리티 함수
  // ==========================================================================
  window.switchTab = function (tabId) {
    state.currentTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });
  };

  function formatWon(num) {
    return (Number(num) || 0).toLocaleString('ko-KR') + '원';
  }

  function getTodayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

})();
