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
    'Jin': '진', 'Ruen': '루엔', 'Kyle': '카일', 'Yuna': '유나', 'The CEO': 'CEO', ' m to ': ' m · 목표: ',
    '◆ Speak with the crew': '◆ 동료와 대화하기',
    '◆ Rest by the fire and feel for the resonance': '◆ 모닥불가에서 쉬며 공명을 느끼기',
    '◆ Go through the gate into the Neon Market': '◆ 문을 지나 네온 시장으로 들어가기',
    '◆ Follow the orb up the avenue': '◆ 대로를 따라 오브를 따라가기',
    '◆ Reach the foot of the tower': '◆ 탑 기슭에 도착하기',
    '◆ Follow the pull to the Industrial Hub gate': '◆ 산업 허브 문으로 향하는 끌림을 따라가기',
    '◆ Cross the Hub to the Foundry': '◆ 허브를 가로질러 파운드리로 가기',
    "◆ Reach the Foundry's shutter": '◆ 파운드리 셔터에 도착하기',
    '◆ Find the three access nodes': '◆ 접근 노드 세 개 찾기',
    "◆ Return to the Foundry's shutter": '◆ 파운드리 셔터로 돌아가기',
    '◆ Enter the Foundry': '◆ 파운드리에 들어가기',
    '◆ Defeat the Loader Mech': '◆ 로더 메카 쓰러뜨리기',
    '◆ Take the Data Core': '◆ 데이터 코어 손에 넣기',
    '◆ Ride the freight lift to the Corporate Spire': '◆ 화물 승강기를 타고 기업 첨탑으로 올라가기',
    '◆ Cross the Spire lobby to the server atrium': '◆ 첨탑 로비를 지나 서버 아트리움으로 가기',
    '◆ Climb to the summit': '◆ 정상까지 오르기',
    '◆ Face the CEO at the summit': '◆ 정상에서 CEO와 맞서기',
    '◆ Defeat the CEO': '◆ CEO 쓰러뜨리기',
    '◆ The city is free. The road goes on.': '◆ 도시는 자유로워졌다. 길은 계속된다.',
    'Thank you for playing.': '플레이해 주셔서 감사합니다.',
    "Tempered Katana": "단련된 카타나",
    "Resonant Katana": "공명의 카타나",
    "Spire-Cut Katana": "첨탑 절단 카타나",
    "Reinforced Coat": "강화 코트",
    "Plated Jacket": "판금 재킷",
    "Data-Orb Core": "데이터 오브 코어",
    "Orb Lattice": "오브 격자",
    "Orb Singularity": "오브 특이점",
    "Stitched Coat": "기운 코트",
    "Hardlight Weave": "하드라이트 직물",
    "Kinetic Gauntlet": "운동 건틀릿",
    "Gauntlet Servos": "건틀릿 서보",
    "Gauntlet Overdrive": "건틀릿 과부하",
    "Plate Harness": "판금 하네스",
    "Bulwark Plate": "방벽 판금",
    "Tuned Blasters": "조율된 블라스터",
    "Plasma Coils": "플라스마 코일",
    "Dual Overclock": "듀얼 오버클럭",
    "Stealth Weave": "은신 직물",
    "Ghost Suit": "고스트 슈트",
    "Vanguard": "선봉",
    "Hacker": "해커",
    "Protector": "수호자",
    "Ranger": "저격수",
    "Pick a perk for each new level in the crew screen (I).": "새 레벨마다 동료 화면(I)에서 특성을 고르세요.",
    "Cleared": "승리",
    "Defeat": "패배",
    "Sector 9": "구역 9",
    "Corporate Spire · Night": "기업 첨탑 · 밤",
    "Industrial Hub · Night": "산업 허브 · 밤",
    "Neon Market · Night": "네온 시장 · 밤",
    "Resting at a camp heals the crew and saves the game. Scrap pays for weapon upgrades, which apply in battle.": "캠프에서 쉬면 동료가 회복되고 게임이 저장됩니다. 폐품은 무기 강화에 쓰이며, 강화는 전투에 바로 적용됩니다.",
    "Items are used from the battle menu. Credits come from fights. Gear is crafted at camps from scrap.": "아이템은 전투 메뉴에서 사용합니다. 크레딧은 전투에서 얻습니다. 장비는 캠프에서 폐품으로 만듭니다.",
    "Quest updated": "임무가 갱신되었습니다",
    "Maxed": "최대",
    "The crew rest. Everyone is back on their feet.": "동료들이 쉽니다. 모두 다시 일어섰습니다.",
    "Weapon": "무기",
    "Armour": "방어구",
    "Battle speed": "전투 속도", "How fast the fights run": "전투가 진행되는 속도", "Auto battle": "자동 전투",
    "The crew pick their first command on their own": "동료가 첫 번째 명령을 스스로 고릅니다",
    "Resonance": "공명",
    "Replay": "다시 보기",
    "Trade": "거래",
    "Rook": "록",
    "Tamsin": "타므신",
    "Juno": "주노",
    "Okoro": "오코로",
    "Ivo": "이보",
    "Vee": "비",
    "Thea": "테아",
    "Dax": "닥스",
    "Mox": "목스",
    "Pell": "펠",
    "Sable": "세이블",
    "Lio": "리오",
    "Wren": "렌",
    "Cass": "카스",
    "Hob": "홉",
    "Ines": "이네스",
    "Marek": "마렉",
    "Tor": "토르",
    "Kesh": "케시",
    "Odalys": "오달리스",
    "Bram": "브람",
    "Sunniva": "수니바",
    "Anselm": "안셀름",
    "Perrin": "페린",
    "Sol": "솔",
    "Mirelle": "미렐",
    "Ward": "워드",
    "Ezra": "에즈라",
    "◆ Break through the husks guarding the gate": "◆ 문을 지키는 허스크를 뚫고 나가기",
    "Act 2 · Chasing the Glitch\nLater. The fire has burned low, and the city has gone strangely quiet.": "2막 · 글리치를 쫓아서\n그로부터 얼마 뒤. 모닥불은 사그라들었고, 도시는 이상할 만큼 조용하다.",
    "Checkpoint 9 · The Industrial Hub\nOne gate in the Market's far wall. Sentry drones hang over it in the haze, their lenses turning.": "검문소 9 · 산업 허브\n시장 먼 벽의 문 하나. 연무 속에서 경계 드론들이 그 위에 떠서 렌즈를 돌리고 있다.",
    "Neon Market · The plaza camp\nA barrel of burning scrap between two dead stalls. For the first time since the alley, nobody is running.": "네온 시장 · 광장 캠프\n죽은 가판대 두 개 사이에서 폐품 드럼통이 타고 있다. 골목 이후 처음으로 아무도 달리지 않는다.",
    'Health': '체력', 'Damage': '피해', 'Gear': '장비', 'Weapon': '무기', 'Armour': '방어구', 'Skills': '기술', 'Bonds': '유대',
    'Max level': '최고 레벨', 'Jobs': '임무', 'Credits': '크레딧', 'Act': '막', 'Perks: ': '특성: ', ' XP': ' 경험치',
    ' ✓ ready to hand in': ' ✓ 제출 가능',
    'No jobs yet. People with a gold mark over their heads have work.': '머리 위에 금색 표시가 있는 사람들이 맡길 일이 있다.',
    'No jobs yet. Talk to the people in the streets.': '아직 임무가 없다. 거리의 사람들과 이야기해 보자.',
    'Not met yet.': '아직 만나지 않았다.', 'No choices made yet.': '아직 선택한 것이 없다.', '???': '???', 'Done': '완료',
    "A note: \"Blue first. Then gold. Red last. A wrong guess starts you over.\"": "메모: \"먼저 파랑. 다음 금색. 마지막 빨강. 틀리면 처음부터다.\"",
    "Husk": "허스크",
    "Husk Brute": "허스크 브루트",
    "Enforcer": "집행자",
    "Sentry Drone": "경계 드론",
    "Seraph Drone": "세라프 드론",
    "Siphon": "사이폰",
    "Crawler": "크롤러",
    "Loader Mech": "로더 메카",
    "Arc Slash": "호 베기",
    "Resonant Edge": "공명의 일격",
    "Mend": "치유",
    "Data Storm": "데이터 폭풍",
    "Bulwark": "방벽",
    "Shockwave": "충격파",
    "Weak Point": "약점 공격",
    "Barrage": "연사 사격",
    "Rising Cut": "상승 베기",
    "Data Surge": "데이터 급류",
    "Taunt": "도발",
    "Snipe": "저격",
    "Crossfire": "교차 공격",
    "Aegis Burst": "이지스 버스트",
    "Iron Vow": "철의 맹세",
    "Vigour": "활력",
    "Edge": "날카로움",
    "Quickening": "가속",
    "Blast": "연사",
    "A sweeping blow that hits every foe": "모든 적을 휩쓰는 일격",
    "A heavy single cut for 3x damage": "단일 적에게 3배 피해를 주는 강한 베기",
    "Heals the whole crew": "동료 전체를 치유",
    "A slower, far bigger Data Burst": "더 느리지만 훨씬 강한 데이터 버스트",
    "The whole crew braces against damage": "동료 전체가 피해에 대비한다",
    "Hits every foe and pushes their gauges back": "모든 적을 공격하고 게이지를 뒤로 밀어낸다",
    "A shot that makes the foe hit 30% softer": "적이 받는 피해를 30% 줄이는 사격",
    "Five shots at random foes": "무작위 적에게 다섯 발 사격",
    "One heavy rising cut for about 36 damage": "약 36 피해의 묵직한 상승 베기",
    "Fills every other crew member's gauge by a quarter": "다른 동료들의 게이지를 4분의 1 채운다",
    "The husks turn on Kyle for six seconds": "6초 동안 허스크들이 카일을 노린다",
    "One aimed shot for about 40 damage": "약 40 피해의 조준 사격",
    "Jin and Yuna strike together and stagger the foe": "진과 유나가 함께 공격해 적을 휘청이게 한다",
    "Kyle and Jin brace and strike together": "카일과 진이 함께 버티고 공격한다",
    "Ruen's burst under Kyle's shield: hits all, Kyle guards": "카일의 방패 아래 루엔의 버스트: 모두 공격, 카일이 방어",
    "A quick punch for about 16 damage.": "약 16 피해의 빠른 펀치.",
    "A heavy swing for about 18 damage.": "약 18 피해의 묵직한 휘두르기.",
    "A bolt of data for about 22 damage.": "약 22 피해의 데이터 볼트.",
    "A slow cast that hits every foe hard. A hit on Ruen breaks it.": "느린 시전으로 모든 적에게 강한 피해. 루엔이 맞으면 시전이 끊긴다.",
    "Two quick blasts for about 14 damage each.": "각 약 14 피해의 빠른 연사 두 발.",
    "Use something from your pack.": "가방의 물건을 사용한다.",
    "Return to the command list.": "명령 목록으로 돌아간다.",
    "Pushes the foe's gauge back, breaks its Crush and shield, and frees locked crew.": "적의 게이지를 뒤로 밀고, 크러시와 보호막을 깨며, 잠긴 동료를 풀어 준다.",
    "Patch Kit": "수리 키트",
    "Revive Kit": "소생 키트",
    "Stim": "흥분제",
    "Flash Grenade": "섬광탄",
    "Heals the most hurt ally by 45%": "가장 다친 동료를 45% 회복",
    "Brings a fallen ally back at 40% health": "쓰러진 동료를 체력 40%로 되살린다",
    "Fills an ally's gauge so they act next": "동료의 게이지를 채워 다음에 행동하게 한다",
    "Pushes every foe's gauge back and breaks wind-ups": "모든 적의 게이지를 뒤로 밀고 준비 동작을 깬다",
    "FREE": "해방",
    "CRUSH BROKEN": "크러시 파괴",
    "SHIELD": "보호막",
    "STAGGER": "스태거",
    "WEAK": "약화",
    "WEAKNESS": "약점!",
    "INTERCEPT": "대신 막음",
    "DRAIN": "흡수",
    "PINNED": "고정",
    "BRACE": "버티기",
    "GUARD": "방어",
    "TAUNT": "도발",
    "READY": "준비",
    "CASTING": "시전 중",
    "Battle!": "전투!",
    "Kyle draws the husks' attention.": "카일이 허스크들의 시선을 끈다.",
    "Ruen is hit. The casting breaks.": "루엔이 피격됐다. 시전이 끊겼다.",
    "Ruen mends the crew.": "루엔이 동료들을 치유한다.",
    "Ruen's Data Surge fills the crew's gauges.": "루엔의 데이터 급류가 동료들의 게이지를 채운다.",
    "Stagger breaks the wind-up.": "스태거가 준비 동작을 깼다.",
    "Yuna breaks the lock on the crew!": "유나가 동료들의 잠금을 풀었다!",
    "Yuna takes a careful aim.": "유나가 신중하게 조준한다.",
    "Yuna's Barrage!": "유나의 연사 사격!",
    "The CEO rewrites the rules!": "CEO가 규칙을 다시 쓴다!",
    "The Loader Mech's glitch takes over!": "로더 메카의 글리치가 주도권을 잡았다!",
    "The crew come to at camp.": "동료들이 캠프에서 정신을 차린다.",
    "The shield is grounded!": "방패가 접지됐다!",
    "The singularity opens! Only a burst from Ruen can ground its shield.": "특이점이 열렸다! 루엔의 버스트만이 방패를 접지시킬 수 있다.",
    "The singularity's shield re-forms.": "특이점의 방패가 다시 형성된다.",
    "Scrap shards rain on the crew!": "폐품 파편이 동료들 위로 쏟아진다!",
    "The Loader Mech sweeps its arm across the crew!": "로더 메카가 팔을 휘둘러 동료들을 쓸어낸다!",
    "The singularity pulses through the crew!": "특이점의 맥동이 동료들을 관통한다!",
    "The CEO sweeps a wave of light across the crew!": "CEO가 빛의 파도로 동료들을 쓸어낸다!",
    "Data Storm!": "데이터 폭풍!",
    "Data Burst!": "데이터 버스트!",
    "Ruen begins Data Storm.": "루엔이 데이터 폭풍을 시전한다.",
    "Ruen begins Data Burst.": "루엔이 데이터 버스트를 시전한다.",
    "Husks! They have seen you.": "허스크다! 들켰다.",
    "Chest opened: ": "상자를 열었다: ",
    "The vault door opens.": "금고 문이 열린다.",
    "Wrong order. The terminals reset.": "순서가 틀렸다. 단말기가 초기화된다.",
    "Terminal powered: ": "단말기 작동: ", 'The city is free, and the road goes on.': '도시는 자유로워졌고, 길은 계속됩니다.',
  };
  let lang = 'en';
  try { lang = localStorage.getItem('nexus.lang') === 'ko' ? 'ko' : 'en'; } catch (e) { /* no storage: English */ }
  // The story dictionary (js/i18n_story.js) is read after the interface entries
  // Sentences with names and numbers in them: each pattern rebuilds the Korean from its translated parts (names, skills, numbers)
  const N = s => tr(s);
  const PATTERNS = [
    [/^(.+) and (.+)'s (.+)!$/, m => `${N(m[1])}·${N(m[2])} ${N(m[3])}!`],
    [/^(.+)'s (.+), under (.+)'s shield!$/, m => `${N(m[1])}의 ${N(m[2])}, ${N(m[3])}의 방패 아래!`],
    [/^(.+)'s (.+) covers the crew\.$/, m => `${N(m[1])}의 ${N(m[2])}, 동료들을 감싼다.`],
    [/^(.+)'s (.+) rocks the foes\.$/, m => `${N(m[1])}의 ${N(m[2])}, 적들을 뒤흔든다.`],
    [/^(.+) braces\.$/, m => `${N(m[1])} 버티기 자세.`],
    [/^(.+) raises (?:his|her) guard\.$/, m => `${N(m[1])} 방어 태세.`],
    [/^(.+) raises its shield\.$/, m => `${N(m[1])} 보호막을 세운다.`],
    [/^(.+) intercepts the blow meant for (.+)!$/, m => `${N(m[1])}, ${N(m[2])} 대신 일격을 막았다!`],
    [/^Stagger pushes (.+) back\.$/, m => `스태거: ${N(m[1])} 뒤로 밀려남.`],
    [/^The CEO lances (.+) with data\.$/, m => `CEO → ${N(m[1])}: 데이터 창 공격.`],
    [/^The CEO locks (.+)'s commands!/, m => `CEO가 ${N(m[1])}의 명령을 잠갔다! 유나의 스태거로 잠금을 풀 수 있다.`],
    [/^(.+) crushes (.+)!$/, m => `${N(m[1])} → ${N(m[2])} 분쇄!`],
    [/^(.+) drains (.+)'s gauge\.$/, m => `${N(m[1])}, ${N(m[2])}의 게이지 흡수.`],
    [/^(.+) fires a burst\.$/, m => `${N(m[1])} 버스트 발사.`],
    [/^(.+) fires at (.+)\.$/, m => `${N(m[1])} → ${N(m[2])} 사격.`],
    [/^(.+) is hit in a weak spot and will hit softer\.$/, m => `${N(m[1])} 약점에 피격, 이후 피해가 줄어든다.`],
    [/^(.+) lashes (.+)\.$/, m => `${N(m[1])} → ${N(m[2])} 채찍 공격.`],
    [/^(.+) lunges at (.+)\.$/, m => `${N(m[1])} → ${N(m[2])} 돌진.`],
    [/^(.+) mends (.+)\.$/, m => `${N(m[1])}, ${N(m[2])} 치유.`],
    [/^(.+) shields (.+)\.$/, m => `${N(m[1])} → ${N(m[2])} 보호막.`],
    [/^(.+) winds up on (.+)!$/, m => `${N(m[1])} 준비 동작 → ${N(m[2])}!`],
    [/^(.+)'s shield soaks the blow\.$/, m => `${N(m[1])}의 보호막이 충격을 흡수했다.`],
    [/^(.+) brings (.+) back!$/, m => `${N(m[1])}, ${N(m[2])} 되살림!`],
    [/^(.+) hits (.+) for (\d+)\.$/, m => `${N(m[1])} → ${N(m[2])}: ${m[3]} 피해.`],
    [/^(.+) braces through it\.$/, m => `${N(m[1])} 버텨 냈다.`],
    [/^(.+) patches up (.+)\.$/, m => `${N(m[1])}, ${N(m[2])} 응급 처치.`],
    [/^(.+) stims (.+)\. They act next\.$/, m => `${N(m[1])}, ${N(m[2])}에게 흥분제. 곧 행동한다.`],
    [/^(.+) throws a flash grenade!$/, m => `${N(m[1])} 섬광탄 투척!`],
    [/^(.+) falls\.$/, m => `${N(m[1])} 쓰러졌다.`],
    [/^(.+) is down!$/, m => `${N(m[1])} 쓰러졌다!`],
    [/^Chest opened: (\d+) credits and an item\.$/, m => `상자를 열었다: ${m[1]} 크레딧과 아이템.`],
    [/^Terminal powered: (\d+) of (\d+)\.$/, m => `단말기 작동: ${m[1]} / ${m[2]}.`],
    // status tags on the battle labels
    [/^LOCKED (\d+)s$/, m => `잠김 ${m[1]}초`], [/^GUARD (\d+)s$/, m => `방어 ${m[1]}초`], [/^BRACE (\d+)s$/, m => `버티기 ${m[1]}초`],
    [/^WEAK (\d+)s$/, m => `약화 ${m[1]}초`], [/^CRUSH (\d+)s$/, m => `크러시 ${m[1]}초`],
    // command descriptions with numbers in them
    [/^Halves the damage you take for (\d+) seconds\.$/, m => `받는 피해를 ${m[1]}초 동안 절반으로 줄인다.`],
    [/^Guards for (\d+) seconds\. A blow that would KO Ruen or Yuna lands on Kyle instead, if his gauge is at least half full\.$/,
      m => `${m[1]}초 동안 방어. 루엔이나 유나를 쓰러뜨릴 일격은 게이지가 절반 이상이면 카일이 대신 맞는다.`],
    [/^(.+)\. Uses half of (.+)'s gauge\.$/, m => `${N(m[1])} 사용. ${N(m[2])} 게이지의 절반을 쓴다.`],
    [/^(.+)\. Needs (.+) up with half a gauge\.$/, m => `${N(m[1])}. ${N(m[2])}이 게이지 절반으로 대기해야 한다.`],
    // items, job progress and the perk count
    [/^(.+) ×(\d+)$/, m => `${N(m[1])} ×${m[2]}`],
    [/^(\d+) \/ (\d+) scrap$/, m => `${m[1]} / ${m[2]} 폐품`],
    [/^(\d+) \/ (\d+) foes$/, m => `${m[1]} / ${m[2]} 적`],
    [/^Deliver to (.+)$/, m => `전달 대상: ${N(m[1])}`],
    [/^Choose a perk \((\d+) to pick\)$/, m => `특성 선택 (${m[1]}개 남음)`],
    [/^Unlocks at Lv (\d+)$/, m => `레벨 ${m[1]}에 해금`],
    [/^Craft ◆ (\d+)$/, m => `제작 ◆ ${m[1]}`],
    [/^(Weapon|Armour) · \+(\d+)% (damage|health)$/, m => `${N(m[1])} · +${m[2]}% ${m[3] === 'damage' ? '피해' : '체력'}`],
    [/^Lv (\d+) · (.+)$/, m => `레벨 ${m[1]} · ${N(m[2])}`],
    [/^Lv (\d+)$/, m => `레벨 ${m[1]}`],
    [/^Lv (\d+) → (\d+) · New: (.+)$/, m => `레벨 ${m[1]} → ${m[2]} · 새 기술: ${N(m[3])}`],
    [/^Lv (\d+) → (\d+)$/, m => `레벨 ${m[1]} → ${m[2]}`],
    [/^\+(\d+) XP(?: · \+(\d+) credits)?$/, m => `+${m[1]} 경험치${m[2] ? ' · +' + m[2] + ' 크레딧' : ''}`],
    [/^(Talk|Trade) · (.+?)( \(!\)| \(✓\))?$/, m => `${m[1] === 'Talk' ? '대화' : '거래'} · ${N(m[2])}${m[3] || ''}`],
  ];
  // Matching ignores line breaks and repeated spaces, so a sentence split over lines still matches
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const KON = {}, STN = {};
  for (const k of Object.keys(KO)) KON[norm(k)] = KO[k];
  const story = () => { if (!Object.keys(STN).length && typeof I18nStory !== 'undefined') for (const k of Object.keys(I18nStory)) STN[norm(k)] = I18nStory[k]; return STN; };
  const tr = s => {
    if (lang !== 'ko') return s;
    const k = norm(s);
    return KON[k] || story()[k] || s;
  };
  // The Korean for a whole line: the exact wording first, then the patterns above; anything else stays as it is
  const line = s => {
    if (lang !== 'ko') return s;
    const d = tr(s); if (d !== s) return d;
    const k = norm(s);
    for (const [re, f] of PATTERNS) { const m = k.match(re); if (m) return f(m); }
    return s;
  };
  // Text the game draws: each text node is remembered with the English it had, so switching back restores it
  const english = new WeakMap(), written = new WeakMap(), tracked = new Set();
  function fixNode(n) {
    if (!n || !n.nodeValue || (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))) return;
    if (written.get(n) === n.nodeValue) return;                 // our own write
    const v = n.nodeValue, key = norm(v);
    if (!key || key.length > 400) return;
    const out = line(key);
    if (out === key && !english.has(n)) return;
    if (!english.has(n)) english.set(n, v);
    const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
    const next = lead + out + tail;
    if (next === v) return;
    n.nodeValue = next; written.set(n, next); tracked.add(n);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixNode(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    while (w.nextNode()) list.push(w.currentNode);
    for (const n of list) fixNode(n);
  }
  // Restores the English of every text node we changed (used when switching to English)
  function restoreEnglish() {
    for (const n of [...tracked]) {
      if (!n.isConnected) { tracked.delete(n); continue; }
      if (english.has(n)) n.nodeValue = english.get(n);
      tracked.delete(n);
    }
  }
  const orig = new WeakMap();
  let watching = false;
  // Translates the page: now, and as the game draws new text (level-ups, toasts, menus)
  function apply() {
    if (lang === 'ko') walk(document.body); else restoreEnglish();
    for (const el of document.querySelectorAll('[title],[aria-label]')) {
      for (const a of ['title', 'aria-label']) {
        const cur = el.getAttribute(a); if (cur === null) continue;
        const key = el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] || cur;
        if (!el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] && !KON[norm(key)]) continue;
        el.dataset[a === 'title' ? 'enTitle' : 'enLabel'] = key;
        el.setAttribute(a, lang === 'ko' ? tr(key) : key);
      }
    }
    document.documentElement.lang = lang;
    if (!watching && typeof MutationObserver !== 'undefined') {
      watching = true;
      new MutationObserver(list => {
        if (lang !== 'ko') return;
        for (const m of list) {
          if (m.type === 'characterData') fixNode(m.target);
          else for (const n of m.addedNodes) walk(n);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
  function set(l) { lang = l === 'ko' ? 'ko' : 'en'; try { localStorage.setItem('nexus.lang', lang); } catch (e) { /* not kept */ } apply(); }
  return { apply, tr, line, set, lang: () => lang, name: () => (lang === 'ko' ? '한국어' : 'English') };
})();
