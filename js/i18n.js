// Nexus - language: English and Korean. The interface text is translated by its exact English wording: a text node, a title or an
// aria-label whose text has a Korean entry is switched when the language changes. The story dialogue stays in English for now.
// The choice is kept in this browser (a small convenience, not game progress).
const I18n = (() => {
  const KO = {
    'Settings': '설정', 'Music': '음악', 'The synthwave score': '신스웨이브 음악', 'Effects': '효과음',
    'Hits, spells, pickups and voices': '타격, 마법, 아이템, 목소리', 'Quality': '화질', 'Auto lowers the detail if the game runs slowly': '게임이 느리면 화질을 자동으로 낮춥니다',
    'Debug': '디버그', 'Frame rate, draw calls, chunk borders, aggro radii, ATB gauges': '프레임, 드로 콜, 구역 경계, 적 감지 범위, ATB 게이지',
    'Difficulty': '난이도', 'How hard the foes hit and how much they can take': '적이 얼마나 세게 때리고 얼마나 버티는지',
    'Save': '저장', 'Save now': '지금 저장', 'The game saves on its own at camps, story points and every few seconds': '캠프, 스토리 지점, 몇 초마다 자동 저장됩니다',
    'Model Check': '모델 확인', 'Watch every move and pose of every character': '모든 캐릭터의 동작과 자세 보기', 'Open': '열기',
    'Challenge mode': '챌린지 모드', 'After the ending: tougher husks, harder hits and bigger rewards': '엔딩 후: 더 강한 적, 더 센 공격, 더 큰 보상',
    'Language': '언어', 'On': '켜짐', 'Off': '꺼짐', 'Auto': '자동', 'High': '높음', 'Low': '낮음', 'Normal': '보통', 'Easy': '쉬움', 'Hard': '어려움',
    'Close': '닫기', 'Back to the title': '타이틀로', 'Keep exploring': '계속 탐험하기', 'Continue': '이어하기', 'New Game': '새 게임', 'Start': '시작',
    'New Game+ (keep levels, perks and gear)': '뉴 게임+ (레벨, 특성, 장비 유지)',
    'Talk': '대화', 'Camp': '캠프', 'Engage': '전투 시작', 'Shop': '상점', 'Travel': '이동', 'Leave': '떠나기', 'Back to the fire': '모닥불로',
    'Crew': '동료', 'Journal': '일지', 'Items': '아이템', 'Jobs': '임무', 'Foes': '적', 'Story': '스토리', 'Skip': '건너뛰기', 'Map': '지도',
    'Strike': '공격', 'Brace': '버티기', 'Guard': '방어', 'Blast': '연사', 'Stagger': '스태거', 'Back': '뒤로', 'Data Bolt': '데이터 볼트',
    'Data Burst': '데이터 버스트', 'Commands': '명령', 'Target': '대상', 'Ready': '준비', 'Pause': '일시정지', 'Paused': '일시정지됨',
    'Sound': '소리', 'Crew (I)': '동료 (I)', 'Journal (J)': '일지 (J)', 'Pause (P)': '일시정지 (P)', 'Running (R)': '달리기 (R)',
    'Settings (gear)': '설정', 'Character': '캐릭터', 'Restart': '다시 시작', 'Close': '닫기',
    'Hover or press a command to read what it does. Let go on it to use it, or slide off to cancel.': '명령 위에 마우스나 손가락을 올리면 설명이 보입니다. 떼면 실행하고, 밖으로 밀면 취소합니다.',
    'Cancelled. Nothing was used.': '취소했습니다. 아무것도 사용하지 않았습니다.',
    'Health': '체력', 'Damage': '피해', 'Gear': '장비', 'Weapon': '무기', 'Armour': '방어구', 'Skills': '기술', 'Bonds': '유대', 'Perks': '특성',
    'Neon District · Night': '네온 지구 · 밤', 'Stick to move · drag to look': '스틱으로 이동 · 드래그로 둘러보기',
    'WASD or the stick to move · Drag to turn the camera · Wheel or pinch to zoom · R toggles run, Shift swaps it · Arrows turn · P pause':
      'WASD 또는 스틱으로 이동 · 드래그로 카메라 회전 · 휠이나 핀치로 확대 · R 달리기 토글, Shift 반대 · 방향키 회전 · P 일시정지',
    'Drag to rotate · wheel or pinch to zoom · two fingers or right-drag to pan · double-tap to reset': '드래그로 회전 · 휠이나 핀치로 확대 · 두 손가락이나 우클릭 드래그로 이동 · 두 번 탭해 초기화',
    'How battle works': '전투 방법', 'Ready': '준비',
    'Thank you for playing.': '플레이해 주셔서 감사합니다.', 'The city is free, and the road goes on.': '도시는 자유로워졌고, 길은 계속됩니다.',
  };
  let lang = 'en';
  try { lang = localStorage.getItem('nexus.lang') === 'ko' ? 'ko' : 'en'; } catch (e) { /* no storage: English */ }
  const tr = s => (lang === 'ko' && KO[s]) || s;
  const orig = new WeakMap();                                   // text node -> the English text it was given
  // Switches every matching text node, title and aria-label on the page (safe to call again)
  function apply() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!orig.has(n)) { const k = n.nodeValue.trim(); if (!KO[k]) continue; orig.set(n, k); }
      const key = orig.get(n), lead = n.nodeValue.match(/^\s*/)[0], tail = n.nodeValue.match(/\s*$/)[0];
      n.nodeValue = lead + tr(key) + tail;
    }
    for (const el of document.querySelectorAll('[title],[aria-label]')) {
      for (const a of ['title', 'aria-label']) {
        const cur = el.getAttribute(a); if (cur === null) continue;
        const key = el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] || cur;
        if (!el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] && !KO[key]) continue;
        el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] = key;
        el.setAttribute(a, tr(key));
      }
    }
    document.documentElement.lang = lang;
  }
  function set(l) { lang = l === 'ko' ? 'ko' : 'en'; try { localStorage.setItem('nexus.lang', lang); } catch (e) { /* not kept */ } apply(); }
  return { apply, tr, set, lang: () => lang, name: () => (lang === 'ko' ? '한국어' : 'English') };
})();
