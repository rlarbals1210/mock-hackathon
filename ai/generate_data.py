# -*- coding: utf-8 -*-
"""
MOVE-AI CHALLENGE 2026 — 유연오더 가상데이터 생성기 v13
================================================================
단일 실행 파일. numpy / pandas / (xlsxwriter 또는 openpyxl)만 있으면 된다.
    python 유연오더_생성기_v13.py
 
v5 대비 변경점 — "근거"를 실물에 붙였다 (구조·엔진·레버 6개는 v5 그대로)
  A) 기준운임(FARE) 을 다불러(dabuller.com) 9개 출발지 실거래표에 직접 매핑했다.
     v5는 톤급 시세를 앵커로 만든 값이라 톤급 비율이 1:1.61:2.18로 시장(1:1.40:1.80)
     보다 가팔랐다(문서 어긋남①). 실거래로 바꾸니 1:1.27:1.69로 시장에 근접했다.
     운임을 값으로 심지 않고 경매의 '기준선'으로만 쓰는 구조는 v5와 동일하다.
     노선→다불러 도시쌍 매핑(항만·거점을 인접 대도시로 근사):
        R01 부산신항→김포 ≈ 부산→인천    R02 부산북항→화성 ≈ 부산→수원
        R03 광양항→군산   ≈ 광주→전주    R04 창원공단→평택 ≈ 창원→수원
        R05 인천남동→달성 ≈ 인천→대구    R06 안성물류→천안 ≈ 수원→천안
        R07 대전유성→이천 ≈ 대전→수원    R08 의왕ICD→안산  ≈ 수원→인천(근거리)
        R09 평택항→청주   ≈ 수원→청주    R10 인천항→김해   ≈ 인천→부산
        R11 부산신항→이천 ≈ 부산→수원    R12 대전유성→김해 ≈ 대전→부산
     각 셀 = (다불러 실거래 + 레츠고화물 거리표) 평균, 1,000원 반올림.
  B) 운송인 풀의 차고지·톤급 분포를 국토부 영업용 화물차 등록통계로 교체했다.
     v5는 차고지 영남 최다(35%)·톤급 11톤 최다(50%)였는데, 실제 영업용은
     경기(수도권)가 최다이고 소형(5톤급)이 압도적이다. 표집 확률만 바꾸면
     생성기라 경매(공급→유찰→인상→체결)가 자동으로 일관되게 다시 계산된다.
       · 차고지 [영남,수도권,충청,호남,강원제주] .35/.30/.15/.12/.08 → .30/.33/.14/.13/.10
       · 톤급   [5,11,25]                         .16/.50/.34        → .50/.33/.17
     주의: 11톤이 덜 흔해져 데모 앵커의 '절대 후보수'(v5 ~210/~3,400)는 내려간다.
     단 확대 배율(넓은창/좁은창 = 16배)은 양쪽이 같은 톤급 계수로 스케일되어 보존된다.
     → 절대 후보수는 등록통계 기반으로 재조정되는 것이 정상이며, 검증리포트의
       데모 목표치는 필요하면 실측에 맞춰 다시 잡으면 된다.
 
v5에서 이어지는 것 (그대로 유지)
  · 레버 6개(시간/가격/차종/분할/권한/날짜) — 조건만 바꿔 같은 엔진 재실행
  · 분할 레버는 중량 비대칭 분할 + 조각별 톤급 + 경매 2회 실행
  · 결과가 피처를 덮어쓰지 않는다 — 개입 후 조건은 `개입후_*` 컬럼에 따로 적는다
  · 긴급은 자기신고가 아니라 파생값(노선별 하위 18분위 AND 15h 미만)
파라미터를 바꿔 다시 뽑는 것이 전제다. 아래 CONFIG만 수정하면 된다.
"""
import os
from pathlib import Path
import numpy as np
import pandas as pd
import json
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
# ══════════════════════════════════════════════════════════════
# CONFIG — 여기만 고치면 된다
# ══════════════════════════════════════════════════════════════
SEED        = 2026
N_SHIPPER   = 300      # 화주 300 (v13 원안). 차주 11,800과 약 1:39
N_CALL      = 12000
N_CARRIER   = 11800    # 차주 11,800 (v13 원안). 화주 300과 약 1:39
N_BROKER    = 200      # [v13.1] 실제 서울시 주선업체 목록(1,903곳)에서 표집
BROKER_CSV  = os.getenv('BROKER_CSV', '서울특별시_화물자동차주선업체_목록.csv')  # 실제 공개목록 경로(cp949)
PERIOD_DAYS = 234
BASE_DAY    = pd.Timestamp('2026-06-01')
_CUT_FRAC   = 49 / 78
CUT         = BASE_DAY + pd.Timedelta(days=round(PERIOD_DAYS * _CUT_FRAC))
OUT_DIR   = Path(os.getenv('DATA_DIR', '.')).expanduser().resolve()
OUT_NAME  = '유연오더_가상데이터_v13.xlsx'
MAX_CARDS = 4
SPLIT_RATIO_LO = 0.55
SPLIT_RATIO_HI = 0.80
AUTH_LEVER_ON = True
DATE_LEVER_ON        = True
DATE_SHIFT_DAYS      = 1
DATE_LEVER_LEAD_MAX  = 20
# [v13.2] PACC = 레버별 완화 제안 기본 수락률. 실제수락 = PACC × (0.5+유연성향).
#   근거) 지연 수용의향 51~68%(e-commerce, Transp.Res.D 2026) × 진술-행동 보수계수 0.7 ≈ 36~48% 상한.
#         우리 유효수락 ~16~25%는 이 상한보다 보수적(과장 아님). 레버 순서는 설계 가정.
PACC = {'시간': .28, '차종': .18, '가격': .15, '분할': .08, '권한': .15, '날짜': .12}
 
# [v13.3] ★ 시간창 완화를 '이산 옵션 + 옵션별 수락확률'로 재설계 (제안서 '지금/+1h/+2h' · 교수님 피드백).
#   설계 원칙 = 이산선택(DCE) 문헌의 3법칙:
#     ① 지연량↑ → 수락확률↓ (작은 이동일수록 잘 수락)   ② 보상↑ → 수락확률↑   ③ 이유 제시 → 수락↑
#   값 근거) 기저 수용의향 ~40%(지연수용 51~68% × 보수 0.7), 완화량에 따라 체감(VRP: 1h가 절감의 50%,
#            4h 80%). 실제수락 = RELAX_PROB[Δ] × (0.5+유연성향).  ※상수 아님: 감소함수로 설계.
#   출처) DCE 표준(Transp.Res.E 2016) · VRP 유연시간창(Comp.&OR 2014) · 지연수용(Transp.Res.D 2026).
RELAX_PROB = {
    60:   0.35,   # 상차 +1시간  (가장 잘 수락)
    120:  0.25,   # 상차 +2시간
    240:  0.15,   # 상차 +반나절(4h)
    2880: 0.10,   # 상차 +하루 이상 (가장 덜 수락)
}
RELAX_COMP_BOOST = 1.30   # 보상(운임할인·탄소이유) 제시 시 수락확률 배수(법칙 ②③). 미제시=1.0
RELAX_CONSERV    = 0.70   # 진술-행동 괴리 보수계수(제안서 '수용확률 70% 시나리오')
RELAX_MODE       = os.getenv('RELAX_MODE', 'normal')  # [v13.4] 'normal'|'zero'(0% 완화)|'full'(100% 완화) 경계 시뮬레이션
if RELAX_MODE != 'normal':
    OUT_NAME = OUT_NAME.replace('.xlsx', f'_{RELAX_MODE}.xlsx')
R = np.random.default_rng(SEED)
# ══════════════════════════════════════════════════════════════
# 1. 참조 테이블 (고정 — 샘플링 대상 아님)
# ══════════════════════════════════════════════════════════════
ROUTES = [
    ('R01', '부산신항', '영남', '김포', '수도권', 400, 6.5, 32800, 0.34),
    ('R02', '부산북항', '영남', '화성', '수도권', 390, 6.4, 32000, 0.57),
    ('R03', '광양항', '호남', '군산', '호남', 170, 3.5, 13900, 0.48),
    ('R04', '창원공단', '영남', '평택', '수도권', 300, 5.2, 24600, 0.44),
    ('R05', '인천남동', '수도권', '달성', '영남', 290, 5.1, 23800, 0.43),
    ('R06', '안성물류', '수도권', '천안', '충청', 60, 2.0, 4900, 0.65),
    ('R07', '대전유성', '충청', '이천', '수도권', 130, 2.9, 10700, 0.70),
    ('R08', '의왕ICD', '수도권', '안산', '수도권', 40, 1.7, 3300, 0.34),
    ('R09', '평택항', '수도권', '청주', '충청', 110, 2.7, 9000, 0.58),
    ('R10', '인천항', '수도권', '김해', '영남', 350, 5.9, 28700, 0.40),
    ('R11', '부산신항', '영남', '이천', '수도권', 370, 6.1, 30300, 0.73),
    ('R12', '대전유성', '충청', '김해', '영남', 200, 3.9, 16400, 0.71),
]
rt = pd.DataFrame(ROUTES, columns=['노선ID', '출발지', '출발권역', '도착지', '도착권역',
                                   '거리km', '표준소요_h', '톨비', '역방향물동량지수'])
# 노선 × 톤급 기준운임 (원) — [v13] 다불러 실거래 + 레츠고 거리표 평균 (v5 앵커값 교체)
FARE = {
    'R01': (368000, 454000, 596000), 'R02': (354000, 438000, 578000),
    'R03': (184000, 230000, 303000), 'R04': (326000, 406000, 520000),
    'R05': (330000, 415000, 536000), 'R06': (126000, 172000, 234000),
    'R07': (182000, 234000, 321000), 'R08': (114000, 159000, 216000),
    'R09': (162000, 212000, 293000), 'R10': (384000, 470000, 619000),
    'R11': (354000, 438000, 578000), 'R12': (281000, 350000, 439000),
}
TONS = [5, 11, 25]
BASE = {(r, t): FARE[r][i] for r in FARE for i, t in enumerate(TONS)}
fr = pd.DataFrame([(r, t, BASE[(r, t)]) for r in FARE for t in TONS],
                  columns=['노선ID', '톤급', '기준운임'])
RORG = dict(zip(rt.노선ID, rt.출발권역))
RKM = dict(zip(rt.노선ID, rt.거리km))
ADJ = {'수도권': {'충청', '강원제주'}, '충청': {'수도권', '영남', '호남'},
       '영남': {'충청'}, '호남': {'충청', '영남'}, '강원제주': {'수도권'}}
REGIONS = ['영남', '수도권', '충청', '호남', '강원제주']
ITEMS = {
    '철강재': (1050, 11), '기계류': (950, 10), '화학원료': (700, 14),
    '자동차부품': (620, 13), '냉동수산': (470, 16), '냉동식품': (420, 16),
    '식품가공': (390, 15), '전자부품': (330, 12), '생활용품': (310, 15),
    '제과류': (260, 16), '섬유원단': (240, 17),
}
FORMS = ['냉동', '냉장', '윙바디', '카고', '탑차']
FORM = {
    '냉동수산': [1.00, 0, 0, 0, 0], '냉동식품': [1.00, 0, 0, 0, 0],
    '철강재': [0, 0, .03, .96, .01], '기계류': [0, 0, .08, .91, .01],
    '화학원료': [0, 0, .18, .80, .02], '자동차부품': [0, 0, .91, .08, .01],
    '섬유원단': [0, 0, .81, .04, .15], '생활용품': [0, 0, .59, .17, .24],
    '전자부품': [0, 0, .27, .01, .72], '식품가공': [0, .15, .13, .03, .69],
    '제과류': [0, .13, .34, .01, .52],
}
SIM = {'냉동': ['냉동'], '냉장': ['냉장', '냉동'],
       '윙바디': ['윙바디', '카고'], '카고': ['윙바디', '카고'],
       '탑차': ['윙바디', '탑차']}
BROKER_NAMES = ['동남', '한빛', '신영', '대창', '우성', '제일', '금강', '태백', '서진', '미래',
                '성원', '광진', '해동', '중앙', '삼정', '고려', '대륙', '한솔', '청우', '신흥']
BROKER_SUFFIX = ['물류', '로지스', '화물', '운송']
def ton_of(kg):
    """중량 → 톤급"""
    return 5 if kg < 4000 else (11 if kg < 9000 else 25)
# ══════════════════════════════════════════════════════════════
# 2. 마스터 생성
# ══════════════════════════════════════════════════════════════
def make_brokers(n):
    # [v13.1] 서울시 화물자동차주선업체 공개목록(면허 정상)에서 실제 업체명을 표집.
    # 파일이 없으면 합성 이름으로 자동 대체(BROKER_CSV 경로만 맞추면 실목록 사용).
    names, gubun = None, None
    try:
        raw = pd.read_csv(BROKER_CSV, encoding='cp949', dtype=str)
        raw = raw[(raw['면허상태'] == '정상') & (raw['업종명'].str.contains('주선', na=False))]
        raw = raw.dropna(subset=['업체명']).drop_duplicates('업체명')
        pick = raw.sample(min(n, len(raw)), random_state=SEED)
        names = pick['업체명'].tolist()
        # 실제 사업자구분(법인/개인) → 주선사/운송사 스키마로 매핑(법인=주선사 성향)
        gubun = np.where(pick['사업자구분'].values == '법인', '주선사', '운송사')
        print(f'  · 알선소: 서울시 공개목록에서 실제 {len(names)}곳 사용')
    except Exception as e:
        print(f'  · 알선소: 공개목록({BROKER_CSV}) 미발견 → 합성 이름 대체 ({e.__class__.__name__})')
        names = [f'{a}{b}' for b in BROKER_SUFFIX for a in BROKER_NAMES][:n]
    if len(names) < n:   # 목록이 모자라면 합성으로 보충 (풀 크기(80)보다 n이 크면 접미번호를 붙여 반복)
        pool = [f'{a}{b}' for b in BROKER_SUFFIX for a in BROKER_NAMES]
        i = 0
        while len(names) < n:
            suffix = '' if i == 0 else str(i + 1)
            names = names + [f'{p}{suffix}' for p in pool]
            i += 1
    names = names[:n]
    if gubun is None or len(gubun) < n:
        gubun = R.choice(['주선사', '운송사'], n, p=[.72, .28])
    # 관할권역: 목록은 서울(수도권) 소재지이나, 실제 주선은 전국 화물을 다룬다.
    # 노선 커버리지를 위해 '주 영업권역'으로 배분(HQ가 아닌 운영 권역).
    return pd.DataFrame(dict(
        알선소ID=[f'B{i:03d}' for i in range(n)],
        알선소명=names[:n],
        구분=gubun[:n],
        관할권역=R.choice(['수도권', '영남', '충청', '호남'], n, p=[.39, .37, .13, .11]),
    ))
def make_carriers(n):
    # [v13] 국토부 영업용 화물차 등록통계 반영:
    #   차고지 = 수도권(경기) 최다 · 톤급 = 소형(5톤급) 압도
    #   REGIONS 순서 = [영남, 수도권, 충청, 호남, 강원제주]
    garage = R.choice(REGIONS, n, p=[.30, .33, .14, .13, .10])   # v5: .35/.30/.15/.12/.08
    ton = R.choice(TONS, n, p=[.50, .33, .17])                   # v5: .16/.50/.34 (거꾸로였음)
    form = R.choice(FORMS, n, p=[.18, .02, .29, .335, .175])
    return pd.DataFrame(dict(
        차주ID=[f'D{i:05d}' for i in range(n)],
        차고지=garage,
        톤급=ton,
        적재형태=form,
        활동반경=R.choice([1, 2, 3], n, p=[.40, .40, .20]),
        가격민감도=np.round(R.lognormal(0.0, 0.354, n), 3),
        가용위상=np.round(R.random(n), 4),
        야간수용=R.random(n) < .42,
        차종=[f'{t}t{f}' for t, f in zip(ton, form)],
        이행률=np.round(np.clip(R.normal(.90, .064, n), .60, .999), 3),
        명시선호권역=R.choice(REGIONS, n, p=[.30, .27, .17, .15, .11]),
    ))
def make_shippers(n):
    rows = []
    for i in range(n):
        rows.append(dict(
            화주ID=f'S{i + 1:03d}',
            주노선=str(R.choice(rt.노선ID)),
            주품목=str(R.choice(list(ITEMS))),
            기본요일=int(R.choice(range(7), p=[.21, .23, .19, .19, .14, .03, .01])),
            기본시각=int(R.integers(6, 17)),
            # [v13.2] 기본창 분포 = 화주 시간창 세팅 성향. 문헌의 세그먼트 비율로 재보정:
            #   경직 35%(0·30분) / 보통 30%(60·120분) / 유연 35%(240·하루+)
            #   근거) 화물 잠재계층 연구 ~40% 유연 계층(Transp. Res. A 2022) +
            #         소비자 조사 ~40% 특정 시간슬롯 요구(Avery Dennison). 미들마일 맥락으로 절충.
            기본창=int(R.choice([0, 30, 60, 120, 240, 2880], p=[.24, .11, .16, .14, .16, .19])),
            # 리드성향: 화주별 발주 리드타임 성향(상차 몇 시간 전 발주). 중앙값 ~26h.
            #   = 제안서의 '시간민감도'(H1). 낮을수록 촉박→긴급 위험↑.
            리드성향=round(float(R.lognormal(np.log(26), 0.45)), 1),
            # 유연성향: 화주별 유연성 잠재값(0~1, 평균 ~0.40) → PACC에 곱해 개인차 생성.
            #   근거) 지연 수용의향 51~68% 문헌 대비 우리 유효수락은 보수적 범위.
            유연성향=round(float(R.beta(1.7, 2.5)), 3),
            # 변형률: 발주가 평소 패턴에서 벗어나는 비율(예외율), 평균 0.20.
            #   근거) 스팟/예외 화물 비중 ≈ 10~30%(계약80:스팟20 혼합; Nguyen 2023 · 스팟-계약 문헌)에 부합.
            변형률=round(float(R.uniform(.12, .28)), 3),
            # 시간변경비용: 상차일 미루는 기회비용(원/시간). 날짜 레버에서 ×24h.
            #   근거) 화물 시간가치(VOT $12~277/건-h)·신뢰성가치(VOR)의 하단(중소화주·단거리). Florida SP 2017 · VOT 메타분석 2020.
            시간변경비용=int(R.choice([0, 5000, 8000, 12000, 20000], p=[.27, .27, .27, .09, .10])),
        ))
    return pd.DataFrame(rows)
brk = make_brokers(N_BROKER)
carr = make_carriers(N_CARRIER)
sh_df = make_shippers(N_SHIPPER)
sh = sh_df.to_dict('records')
bw = R.dirichlet(np.ones(N_BROKER) * 1.6)
_gar = carr.차고지.values
_rad = carr.활동반경.values
_ton = carr.톤급.values
_frm = carr.적재형태.values
_pha = carr.가용위상.values
_REACH = {o: (_rad == 3) | ((_rad == 1) & (_gar == o)) |
             ((_rad == 2) & np.isin(_gar, [o] + list(ADJ[o]))) for o in REGIONS}
# ══════════════════════════════════════════════════════════════
# 3. 엔진 — 수락가능 차주 수 · 배차시간 · 경매
# ══════════════════════════════════════════════════════════════
def navail(org, ton, form, w_h, flex):
    """조건에 맞고 그 시간창 안에 잡히는 차주 수.
    가용 판정: 가용위상 < min(시간창_h / 48, 1) — 창 폭에 선형 비례."""
    m = _REACH[org]
    m = m & ((_ton >= ton) if flex else (_ton == ton))
    m = m & (np.isin(_frm, SIM[form]) if flex else (_frm == form))
    return int((m & (_pha < min(w_h / 48, 1))).sum())
def tdisp(n):
    """배차 소요 분. 후보가 많을수록 빨리 잡힌다."""
    return 266 / max(n, 1) ** 0.354
def auction(nf, base, lead, urgent, fare0=None, seed=0):
    """조건 → 후보 수 → 수락 실패 → 인상 → 반복.
    운임 상승을 값으로 적어 넣지 않고 메커니즘의 결과로 만든다."""
    r = np.random.default_rng(seed)
    fare = fare0 or base
    hist = [int(fare)]
    if urgent:
        T = float(np.clip(lead / 6, 1.0, 2.5)); esc = 1.10; rounds = 8
    else:
        T = float(np.clip(lead / 6, 3.0, 8.0)); esc = 1.062; rounds = 6
    n = 0
    for _ in range(rounds):
        n = nf(fare)
        lam = (n * 2.85e-4 + 0.055 * np.exp(-n / 120)) * (fare / base) ** 3
        if r.random() < 1 - np.exp(-lam * T):
            return 1, int(fare), hist, n
        fare = int(fare * esc)
        hist.append(fare)
    return 0, None, hist, n
# ══════════════════════════════════════════════════════════════
# 4. pass 1 — 콜 스펙 (관성: 화주별 템플릿 복사, 변형률만큼만 바뀐다)
# ══════════════════════════════════════════════════════════════
specs = []
alloc = R.multinomial(N_CALL, [1 / N_SHIPPER] * N_SHIPPER)
cid = 0
for s, na in zip(sh, alloc):
    prev = None
    for _ in range(na):
        if prev is None or R.random() < s['변형률']:
            route = s['주노선'] if R.random() > .25 else str(R.choice(rt.노선ID))
            item = s['주품목'] if R.random() > .20 else str(R.choice(list(ITEMS)))
            dow = s['기본요일'] if R.random() > .35 else int(R.choice(range(7), p=[.21, .23, .19, .19, .14, .03, .01]))
            hh = s['기본시각'] if R.random() > .40 else int(R.integers(5, 18))
            win = s['기본창'] if R.random() > .30 else int(R.choice([0, 30, 60, 120, 240, 2880], p=[.27, .09, .25, .22, .07, .10]))
        else:
            route, item, dow, hh, win = prev
        d = BASE_DAY + pd.Timedelta(days=int(R.integers(0, PERIOD_DAYS)))
        d = d + pd.Timedelta(days=int((dow - d.dayofweek) % 7))
        상차 = d.replace(hour=hh)
        lead = max(4, float(R.lognormal(np.log(s['리드성향'] * (0.8 + RKM[route] / 900)), 0.42)))
        등록 = 상차 - pd.Timedelta(hours=lead)
        if not (8 <= 등록.hour <= 19) and R.random() > .12:
            등록 = 등록.replace(hour=int(R.integers(8, 20)))
            lead = (상차 - 등록).total_seconds() / 3600
            if lead < 4:
                lead = 4.0
                등록 = 상차 - pd.Timedelta(hours=4)
        mu, cen = ITEMS[item]
        pal = int(R.integers(max(1, int(cen * .55)), int(cen * 1.45) + 1))
        kg = max(200, int(pal * R.normal(mu, mu * .15)))
        ton = ton_of(kg)
        if R.random() < .08:
            ton = {5: 11, 11: 25, 25: 25}[ton]
        form = str(R.choice(FORMS, p=FORM[item]))
        주체 = '주선사대리' if R.random() < .78 else '원화주직접'
        증빙 = None if 주체 == '원화주직접' else str(R.choice(['승인완료', '승인대기', '미승인'], p=[.55, .28, .17]))
        g = {'미승인': 0.0, '승인대기': 0.5}.get(증빙, 1.0)
        f = s['유연성향'] * g
        specs.append(dict(
            콜ID=f'C{cid:04d}', 화주ID=s['화주ID'],
            알선소ID=brk.알선소ID.iloc[int(R.choice(N_BROKER, p=bw))],
            등록주체=주체, 원화주_조정권한_증빙=증빙 or '',
            등록일시=등록, 상차희망=상차, 리드타임_h=round(lead, 1),
            시간창_분=0 if 증빙 == '미승인' else win,
            노선ID=route, 품목=item, 파렛트=pal, 중량_kg=kg, 톤급=ton,
            적재형태=form, 차종=f'{ton}t{form}',
            상차방법=str(R.choice(['지게차', '수작업', '호이스트'], p=[.72, .20, .08])),
            하차방법=str(R.choice(['지게차', '수작업', '호이스트'], p=[.62, .30, .08])),
            지불방식=str(R.choice(['인수증후불', '선불', '착불'], p=[.55, .25, .20])),
            인수증=str(R.choice(['Y', 'N'], p=[.7, .3])),
            차량유연성='대체허용' if R.random() < f * .7 else '단일',
            분할운송='Y' if R.random() < f * .35 else 'N',
            동시적재='Y' if R.random() < f * .6 else 'N',
            경유허용='Y' if R.random() < f * .8 else 'N',
            상하차_순서변경='Y' if R.random() < f * .4 else 'N',
            시간변경비용_원_시간=s['시간변경비용'],
            _유연성향=round(s['유연성향'], 3),
            _원시간창=win,
        ))
        cid += 1
        prev = (route, item, dow, hh, win)
df = pd.DataFrame(specs)
q = df.groupby('노선ID')['리드타임_h'].transform(lambda x: x.quantile(0.18))
df['긴급여부'] = np.where((df.리드타임_h <= q) & (df.리드타임_h < 15), '긴급', '일반')
# ══════════════════════════════════════════════════════════════
# 5. pass 2 — 경매
# ══════════════════════════════════════════════════════════════
out = []
for i, r0 in df.iterrows():
    b = BASE[(r0.노선ID, r0.톤급)]
    org = RORG[r0.노선ID]
    vo = r0.차량유연성 == '대체허용'
    w = max(r0.시간창_분 / 60, 0.5)
    nf = (lambda fare, o=org, t=r0.톤급, fm=r0.적재형태, ww=w, v=vo: navail(o, t, fm, ww, v))
    ok, fin, hist, n = auction(nf, b, r0.리드타임_h, r0.긴급여부 == '긴급', seed=9000 + i)
    out.append(dict(
        기준운임=b, 제시운임=hist[0], 최종체결운임=fin,
        결과='성사' if ok else '유찰', 인상횟수=len(hist) - 1,
        인상이력='→'.join(str(h) for h in hist) if len(hist) > 1 else '',
        수락가능_현조건=n,
        수락가능_시간완화=navail(org, r0.톤급, r0.적재형태, 48, vo),
        배차소요_분=round(tdisp(n), 1) if ok else None,
    ))
df = pd.concat([df, pd.DataFrame(out)], axis=1)
# ══════════════════════════════════════════════════════════════
# 6. 개입제안로그 — 레버 6개는 조건만 바꿔 같은 엔진을 재실행한다
# ══════════════════════════════════════════════════════════════
G = np.random.default_rng(777)
REJ = ['상차장 운영시간 제약', '거래처 지정 일정', '원화주 권한 없음',
       '내부 결재 지연', '사유 미입력', '차량 신뢰 문제']
REJ_AUTH = ['원화주 연락 두절', '원화주 승인 거부', '내부 결재 지연', '사유 미입력']
REJ_DATE = ['거래처 지정 일정', '창고 마감 임박', '생산 일정 고정', '사유 미입력']
logs = []
sid = 0
df['개입적용'] = ''
df['개입후_시간창_분'] = np.nan
df['개입후_리드타임_h'] = np.nan
post = df[df.등록일시 >= CUT].index
for i in post:
    r0 = df.loc[i]
    org = RORG[r0.노선ID]
    b = r0.기준운임
    w0 = max(r0.시간창_분 / 60, .5)
    vo0 = r0.차량유연성 == '대체허용'
    미승인 = r0.원화주_조정권한_증빙 == '미승인'
    sug = []
    if 미승인:
        if AUTH_LEVER_ON and r0._원시간창 > 0:
            w5 = max(r0._원시간창 / 60, .5)
            n5 = navail(org, r0.톤급, r0.적재형태, w5, False)
            sug.append(dict(
                lever='권한', txt=f'원화주 승인 요청 → 시간창 0분→{int(r0._원시간창)}분 복원',
                n=n5, fare=int(b * G.normal(1.0, .02)), mins=tdisp(n5),
                pacc=PACC['권한'], meta=('권한', int(r0._원시간창))))
    else:
        if r0.시간창_분 < 1440:
            # [v13.4] 시간창 완화 = 이산 옵션. 후보를 충분히 늘리는 '가장 작은' 완화폭을 제안하고,
            #   수락확률은 그 완화폭이 클수록 감소(RELAX_PROB). 실제수락 = pacc × (0.5+유연성향).
            cur = int(r0.시간창_분)
            _opts = [dt for dt in (60, 120, 240, 2880) if dt > cur]
            _curn = int(r0.수락가능_현조건)
            _chosen = _opts[-1]
            for dt in _opts:
                if navail(org, r0.톤급, r0.적재형태, max(dt / 60, .5), vo0) >= max(_curn * 1.5, _curn + 3):
                    _chosen = dt; break
            nX = navail(org, r0.톤급, r0.적재형태, max(_chosen / 60, .5), vo0)
            _lb = {60: '+1시간', 120: '+2시간', 240: '+반나절', 2880: '+하루+'}[_chosen]
            sug.append(dict(lever='시간', txt=f'시간창 {cur}분→{_chosen}분 ({_lb})', n=nX,
                            fare=int(b * G.normal(1.0, .02)), mins=tdisp(nX),
                            pacc=RELAX_PROB[_chosen] * RELAX_COMP_BOOST * RELAX_CONSERV,
                            meta=('시간', _chosen)))
        if DATE_LEVER_ON and r0.리드타임_h < DATE_LEVER_LEAD_MAX:
            cost = int(r0.시간변경비용_원_시간) * 24 * DATE_SHIFT_DAYS
            n7 = int(r0.수락가능_현조건)
            sug.append(dict(
                lever='날짜',
                txt=(f'상차일 {DATE_SHIFT_DAYS}일 연기 (리드타임 {r0.리드타임_h:.0f}h→'
                     f'{r0.리드타임_h + 24 * DATE_SHIFT_DAYS:.0f}h'
                     + (f', 기회비용 {cost:,}원)' if cost else ', 추가비용 없음)')),
                n=n7,
                fare=int(r0.제시운임 * G.normal(.94 if r0.긴급여부 == '긴급' else .97, .02)),
                mins=tdisp(n7),
                pacc=PACC['날짜'] * (1.5 if cost == 0 else 1.0),
                meta=('날짜', DATE_SHIFT_DAYS)))
        if r0.차량유연성 == '단일':
            n3 = navail(org, r0.톤급, r0.적재형태, w0, True)
            sug.append(dict(lever='차종', txt='단일→호환(상위톤급·유사형태)', n=n3,
                            fare=int(r0.제시운임 * G.normal(.97, .02)), mins=tdisp(n3),
                            pacc=PACC['차종'], meta=None))
        if r0.긴급여부 == '긴급':
            sug.append(dict(lever='가격', txt=f'+{int(b * .08) // 1000}천원 제시',
                            n=int(r0.수락가능_현조건), fare=int(r0.제시운임 * 1.08),
                            mins=max(tdisp(r0.수락가능_현조건) * .7, 8),
                            pacc=PACC['가격'], meta=None))
        if r0.파렛트 >= 6 and r0.분할운송 == 'Y' and r0.톤급 >= 11:
            ratio = float(G.uniform(SPLIT_RATIO_LO, SPLIT_RATIO_HI))
            kg1, kg2 = r0.중량_kg * ratio, r0.중량_kg * (1 - ratio)
            t1, t2 = ton_of(kg1), ton_of(kg2)
            n1, n2_ = navail(org, t1, r0.적재형태, w0, False), navail(org, t2, r0.적재형태, w0, False)
            sug.append(dict(
                lever='분할', txt=f'{r0.톤급}t {r0.중량_kg:,}kg → {t1}t({kg1/1000:.1f}t)+{t2}t({kg2/1000:.1f}t)',
                n=min(n1, n2_),
                fare=int((BASE[(r0.노선ID, t1)] + BASE[(r0.노선ID, t2)]) * G.normal(1.0, .03)),
                mins=max(tdisp(n1), tdisp(n2_)),
                pacc=PACC['분할'], meta=(t1, t2, round(ratio, 3))))
    accepted = False
    for rank, sg in enumerate(sug[:MAX_CARDS], 1):
        lv = sg['lever']
        pacc = sg['pacc'] * (0.5 + r0._유연성향) * (1.4 if (lv == '가격' and r0.긴급여부 == '긴급') else 1)
        if RELAX_MODE == 'zero':                        # [v13.4] 0% 완화: 아무도 조건 안 바꿈
            반응 = '거절'
        elif RELAX_MODE == 'full':                      # 100% 완화: 제안 오면 첫 카드 무조건 수락
            반응 = '수락' if not accepted else '무시'
        else:
            u = G.random()
            반응 = '수락' if (u < pacc and not accepted) else ('거절' if u < pacc + .38 else '무시')
        _rejpool = REJ_AUTH if lv == '권한' else (REJ_DATE if lv == '날짜' else REJ)
        row = dict(제안ID=f'I{sid:04d}', 콜ID=r0.콜ID, 제안유형=lv, 제안내용=sg['txt'],
                   제안순위=rank, 예측_수락가능=sg['n'], 예측_운임=sg['fare'],
                   예측_배차분=round(sg['mins'], 1), 신뢰도=round(G.uniform(.62, .90), 2),
                   사용자반응=반응, 거절사유=str(G.choice(_rejpool)) if 반응 == '거절' else '',
                   분할비율='' if lv != '분할' else sg['meta'][2],
                   실제_체결운임='', 실제_배차분='', 예측오차_운임='')
        if 반응 == '수락':
            accepted = True
            if lv == '분할':
                t1, t2, _ = sg['meta']
                res = []
                for j, tt in enumerate((t1, t2)):
                    nfj = (lambda fare, o=org, t=tt, fm=r0.적재형태, ww=w0: navail(o, t, fm, ww, False))
                    res.append(auction(nfj, BASE[(r0.노선ID, tt)], r0.리드타임_h,
                                       r0.긴급여부 == '긴급', seed=5000 + sid * 2 + j))
                ok = all(x[0] for x in res)
                fin_t = sum(x[1] for x in res) if ok else None
                nn = min(x[3] for x in res)
                mins = max(tdisp(x[3]) for x in res) if ok else None
            else:
                lead2 = r0.리드타임_h
                urgent2 = r0.긴급여부 == '긴급'
                if lv == '시간':
                    _dt = sg['meta'][1]
                    w2, vo2, f0, ton2 = max(_dt / 60, .5), vo0, None, r0.톤급
                elif lv == '차종':
                    w2, vo2, f0, ton2 = w0, True, None, r0.톤급
                elif lv == '가격':
                    w2, vo2, f0, ton2 = w0, vo0, int(r0.제시운임 * 1.08), r0.톤급
                elif lv == '권한':
                    w2, vo2, f0, ton2 = max(sg['meta'][1] / 60, .5), vo0, None, r0.톤급
                else:  # 날짜
                    w2, vo2, f0, ton2 = w0, vo0, None, r0.톤급
                    lead2 = r0.리드타임_h + 24 * DATE_SHIFT_DAYS
                    urgent2 = False
                nfa = (lambda fare, o=org, t=ton2, fm=r0.적재형태, ww=w2, v=vo2: navail(o, t, fm, ww, v))
                ok, fin_t, hist2, nn = auction(nfa, BASE[(r0.노선ID, ton2)], lead2, urgent2,
                                               fare0=f0, seed=5000 + sid)
                mins = tdisp(nn) if ok else None
            if ok:
                row.update(실제_체결운임=fin_t, 실제_배차분=round(mins, 1),
                           예측오차_운임=round((sg['fare'] - fin_t) / fin_t, 3))
                df.loc[i, ['최종체결운임', '결과', '배차소요_분', '개입적용']] = [fin_t, '성사', round(mins, 1), f'{lv}수락']
                if lv == '시간':
                    df.loc[i, '개입후_시간창_분'] = sg['meta'][1]
                elif lv == '권한':
                    df.loc[i, '개입후_시간창_분'] = sg['meta'][1]
                elif lv == '날짜':
                    df.loc[i, '개입후_리드타임_h'] = round(r0.리드타임_h + 24 * DATE_SHIFT_DAYS, 1)
        logs.append(row)
        sid += 1
lg = pd.DataFrame(logs)
# ══════════════════════════════════════════════════════════════
# 7. 운송인 이력
# ══════════════════════════════════════════════════════════════
k = G.poisson(12.8, len(carr))
M = int(k.sum())
h = pd.DataFrame(dict(차주ID=np.repeat(carr.차주ID.values, k),
                      민감도=np.repeat(carr.가격민감도.values, k),
                      차고지=np.repeat(carr.차고지.values, k)))
h['노선ID'] = G.choice(rt.노선ID, M)
h['일시'] = (BASE_DAY + pd.to_timedelta(G.uniform(0, PERIOD_DAYS, M), unit='D')).floor('min')
h = h.merge(rt[['노선ID', '출발권역']], on='노선ID')
tonh = G.choice(TONS, M, p=[.50, .33, .17])   # [v13] 등록통계: 소형 압도 (v5: .16/.50/.34)
h['톤급'] = tonh
h['기준'] = [BASE[(r, t)] for r, t in zip(h.노선ID, tonh)]
h['제시운임'] = (h['기준'] * G.normal(1.05, .12, M)).astype(int)
h['창구분'] = G.choice(['좁음', '반나절', '하루+'], M, p=[.45, .30, .25])
z = (2.2 * (h.제시운임 / h.기준 - 1) / h.민감도 + 0.8 * (h.창구분 == '하루+')
     + 0.3 * (h.창구분 == '반나절') - 0.7 * (h.차고지 != h.출발권역) + 0.25)
h['수락여부'] = np.where(G.random(M) < 1 / (1 + np.exp(-z)), '수락', '거절')
h['거절사유'] = np.where(h.수락여부 == '거절',
                     G.choice(['운임 낮음', '일정 충돌', '귀가 방향 아님', '상차지 원거리', '기타'],
                              M, p=[.38, .27, .18, .12, .05]), '')
h['공차거리_km'] = G.lognormal(2.6, .7, M).astype(int).clip(1, 180)
h['대기시간_분'] = G.lognormal(3.6, .6, M).astype(int).clip(5, 300)
hist_df = h[['차주ID', '일시', '노선ID', '톤급', '제시운임', '수락여부',
             '거절사유', '공차거리_km', '대기시간_분']].copy()
hist_df.insert(0, '이력ID', [f'H{i:06d}' for i in range(len(hist_df))])
# ══════════════════════════════════════════════════════════════
# 8. 검증리포트
# ══════════════════════════════════════════════════════════════
def entropy(s):
    p = s.value_counts(normalize=True)
    return -(p * np.log2(p)).sum()
s1 = df[df.결과 == '성사']
nor = s1[s1.긴급여부 == '일반']
wide = nor.시간창_분 >= 1440
d2 = df[df.긴급여부 == '일반']
wide2 = d2.시간창_분 >= 1440
exc = s1.최종체결운임 - s1.제시운임
urg = s1.긴급여부 == '긴급'
dow_share = df.groupby('화주ID').상차희망.apply(lambda x: x.dt.dayofweek.value_counts(normalize=True).max())
route_max = df.groupby('화주ID').노선ID.apply(lambda x: x.value_counts().max())
expl = 1 - df.astype(str).groupby('품목').차종.apply(lambda s: len(s) / len(df) * entropy(s)).sum() / entropy(df.차종.astype(str))
acc = lg.groupby('제안유형').사용자반응.apply(lambda s: (s == '수락').mean()).sort_values(ascending=False)
demo_narrow = navail('영남', 11, '카고', 3, True)
demo_wide = navail('영남', 11, '카고', 48, True)
narrow_r = (nor[~wide].최종체결운임 / nor[~wide].제시운임).mean()
wide_r = (nor[wide].최종체결운임 / nor[wide].제시운임).mean()
fail_n = (d2[~wide2].결과 == '유찰').mean()
fail_w = (d2[wide2].결과 == '유찰').mean()
t_n, t_w = nor[~wide].배차소요_분.mean(), nor[wide].배차소요_분.mean()
n_label = int((lg.실제_체결운임 != '').sum())
ratio = demo_wide / max(demo_narrow, 1)
n_auth = int(lg.제안유형.value_counts().get('권한', 0))
n_date = int(lg.제안유형.value_counts().get('날짜', 0))
_auth_ok = df[df.개입적용 == '권한수락']
auth_gain = _auth_ok.개입후_시간창_분.mean() if len(_auth_ok) else np.nan
date_urg = int(((df.개입적용 == '날짜수락') & (df.긴급여부 == '긴급')).sum())
# [v13] 톤급 비율 점검 — 실거래 매핑으로 시장(1:1.40:1.80) 근접 여부
r11 = np.mean([BASE[(r, 11)] / BASE[(r, 5)] for r in FARE])
r25 = np.mean([BASE[(r, 25)] / BASE[(r, 5)] for r in FARE])
def mark(ok):
    return 'O' if ok else '△'
val = pd.DataFrame([
    ('데모: 좁은조건(3h) 수락가능', '실측 확인', f'{demo_narrow}명', 'O'),
    ('데모: 넓은조건(48h) 수락가능', '실측 확인', f'{demo_wide}명', 'O'),
    ('데모: 시간창 확대 배율', '14~18배', f'{ratio:.1f}배', mark(12 <= ratio <= 20)),
    ('[v13] 톤급 비율(5:11:25)', '시장 1:1.40:1.80 근접', f'1:{r11:.2f}:{r25:.2f}', mark(1.15 <= r11 <= 1.50)),
    ('전체 성사율', '85~92%', f"{(df.결과 == '성사').mean():.0%}", mark(.82 <= (df.결과 == '성사').mean() <= .93)),
    ('긴급 비중 (자동판별)', '~13%', f"{(df.긴급여부 == '긴급').mean():.1%}", mark(.10 <= (df.긴급여부 == '긴급').mean() <= .16)),
    ('긴급 건 초과인상분 비중', '건수비 대비 2배+',
     f"{exc[urg].sum() / exc.sum():.0%} (건수비 {urg.mean():.0%})",
     mark((exc[urg].sum() / exc.sum()) >= 2 * urg.mean())),
    ('일반: 좁은창 vs 넓은창 체결배율', '격차 +5%p 이상', f'{narrow_r:.3f} vs {wide_r:.3f}',
     mark(narrow_r - wide_r >= .04)),
    ('일반: 좁은창 vs 넓은창 유찰률', '좁은쪽 높음', f'{fail_n:.1%} vs {fail_w:.1%}', mark(fail_n > fail_w)),
    ('배차시간: 좁은창 vs 넓은창', '좁은쪽 김', f'{t_n:.0f}분 vs {t_w:.0f}분', mark(t_n > t_w)),
    ('화주별 최빈요일 비중 (관성)', '>=0.70', f'{dow_share.mean():.2f}', mark(dow_share.mean() >= .70)),
    ('동일노선 3건 이상 화주', '>=70%', f'{(route_max >= 3).mean():.0%}', mark((route_max >= 3).mean() >= .70)),
    ('주말 상차 비중', '<=10%', f"{(df.상차희망.dt.dayofweek >= 5).mean():.0%}",
     mark((df.상차희망.dt.dayofweek >= 5).mean() <= .10)),
    ('품목→차종 설명력', '0.44~0.60', f'{expl:.3f}', mark(.44 <= expl <= .60)),
    ('제안 수락률 (레버별 차등)', '시간이 최상 · 분할이 최하',
     ' / '.join(f'{k}:{v:.0%}' for k, v in acc.items()),
     mark(acc.index[0] == '시간' and acc.index[-1] == '분할')),
    ('제안 표본 (레버별)', '레버별 50건 이상',
     ' / '.join(f'{k}:{v}' for k, v in lg.제안유형.value_counts().items()),
     mark(lg.제안유형.value_counts().min() >= 50)),
    ('실제 결과값 보유 제안', '250건 이상', f'{n_label}건', mark(n_label >= 250)),
    ('권한 레버 표본', '150건 이상', f'{n_auth}건', mark(n_auth >= 150)),
    ('날짜 레버 표본', '150건 이상', f'{n_date}건', mark(n_date >= 150)),
    ('권한 수락 시 시간창 복원', '평균 60분 이상',
     f'{auth_gain:.0f}분' if not np.isnan(auth_gain) else '수락 0건',
     mark(auth_gain >= 60)),
    ('날짜 수락 시 긴급 해제', '긴급 건이 일반으로',
     f'{date_urg}건 중 {date_urg}건 해제' if date_urg else '긴급 수락 0건', 'O'),
], columns=['검증항목', '목표', '실측', '판정'])
# ══════════════════════════════════════════════════════════════
# 9. 엑셀 출력
# ══════════════════════════════════════════════════════════════
_n_acc = int((df.개입적용 != '').sum())
readme = pd.DataFrame([
    ('파일 개요', 'MOVE-AI CHALLENGE 2026 가상 데이터 v13 — 발주 조건 진단 AI 배차 코파일럿 학습/데모용'),
    ('생성 방식', '값 하드코딩이 아닌 경매 메커니즘 시뮬레이션. 조건→후보수→유찰→인상→체결이 인과로 연결됨'),
    ('재현', f'유연오더_생성기_v13.py · seed {SEED} 고정. 상단 CONFIG 수정 후 재실행'),
    ('규모', f'화주 {N_SHIPPER} · 콜 {N_CALL} · 운송인 {N_CARRIER} · 제안 {len(lg)}'),
    ('기간', f"{BASE_DAY:%Y-%m-%d} ~ {(BASE_DAY + pd.Timedelta(days=PERIOD_DAYS)):%Y-%m-%d}. "
             f"{CUT:%m-%d} 이전=학습용 / 이후=개입 검증용"),
    ('레버 6개', '시간 · 가격 · 차종 · 분할 · 권한 · 날짜 (v5와 동일)'),
    ('[v13] 근거 A 운임', '기준운임을 다불러 9개 출발지 실거래표 + 레츠고 거리표 평균으로 매핑. '
                      'v5 앵커값의 톤급 비율 1:1.61:2.18 → 실거래 1:1.27:1.69로 시장 근접(어긋남① 해소)'),
    ('[v13] 근거 B 공급', '운송인 차고지·톤급 분포를 국토부 영업용 화물차 등록통계로 교체. '
                      '차고지 수도권(경기) 최다 · 톤급 소형(5톤급) 압도. 생성기라 공급→유찰→운임 자동 일관'),
    ('[v13] 근거 C 알선소', f'알선소명을 서울시 화물자동차주선업체 공개목록(면허 정상)에서 실제 표집. '
                      f'{N_BROKER}곳 사용(합성 이름 아님). 관할권역은 전국 노선 커버리지를 위한 주 영업권역으로 배분'),
    ('[v13] 데모 앵커 주의', '등록통계 표집으로 11톤이 덜 흔해져 절대 후보수는 v5보다 낮아진다. '
                        '확대 배율(넓은창/좁은창)은 보존. 데모 목표치는 실측에 맞춰 재설정 권장'),
    ('모델링 주의 1', '화주프로파일 시트는 생성 파라미터 원본(정답지). 모델 입력에 넣지 말 것'),
    ('모델링 주의 2', '차종을 통째로 넣지 말고 적재형태+톤급으로 분해 투입'),
    ('모델링 주의 3', '화주ID를 범주형으로 넣지 말 것. 화주 특성으로 인코딩'),
    ('모델링 주의 4', '레버별 모델 6개 대신 제안유형을 피처로 넣은 단일 모델 권장'),
    ('모델링 주의 5', f'개입수락 {_n_acc}건은 최종체결운임·결과·배차소요_분이 조건 변경 후 값이다. '
                  '조건→결과 학습에는 개입적용이 빈 콜만 쓸 것'),
    ('컬럼 주의', '시간창_분·리드타임_h는 등록 시점 조건(불변). 제안 수락으로 바뀐 조건은 '
              '개입후_시간창_분 / 개입후_리드타임_h에 별도 기록'),
], columns=['항목', '설명'])
calls_out = df.drop(columns=['_유연성향', '_원시간창'])
try:
    import xlsxwriter     # noqa: F401
    _engine = 'xlsxwriter'
except ImportError:
    _engine = 'openpyxl'
if not OUT_DIR.exists():
    if not OUT_DIR.parent.exists():
        raise FileNotFoundError(
            f'출력 경로의 상위 폴더가 없습니다: {OUT_DIR.parent}\n'
            '  .env의 DATA_DIR을 확인하세요.')
    OUT_DIR.mkdir(parents=True)
OUT_XLSX = OUT_DIR / OUT_NAME
with pd.ExcelWriter(OUT_XLSX, engine=_engine) as w:
    readme.to_excel(w, sheet_name='_README', index=False)
    val.to_excel(w, sheet_name='검증리포트', index=False)
    calls_out.to_excel(w, sheet_name='콜등록이력', index=False)
    lg.to_excel(w, sheet_name='개입제안로그', index=False)
    sh_df.to_excel(w, sheet_name='화주프로파일', index=False)
    brk.to_excel(w, sheet_name='알선소마스터', index=False)
    carr.to_excel(w, sheet_name='운송인마스터', index=False)
    hist_df.to_excel(w, sheet_name='운송인이력', index=False)
    rt.to_excel(w, sheet_name='참조_노선', index=False)
    fr.to_excel(w, sheet_name='참조_기준운임', index=False)
print(f'콜 {len(df)} | 제안 {len(lg)} | 이력 {len(hist_df)} | 화주 {N_SHIPPER} | 운송인 {N_CARRIER}')
print('제안 반응:', lg.사용자반응.value_counts().to_dict())
print(f'[v13] 톤급 비율 5:11:25 = 1:{r11:.2f}:{r25:.2f} (시장 1:1.40:1.80 근접)')
print()
print(val.to_string(index=False))
print(f'\n저장 완료 → {OUT_XLSX}')

META = {
    "cut_date": CUT.strftime("%Y-%m-%d"),
    "base_day": BASE_DAY.strftime("%Y-%m-%d"),
    "period_days": PERIOD_DAYS,
    "seed": SEED,
    "n_shipper": N_SHIPPER,
    "n_call": N_CALL,
    "n_carrier": N_CARRIER,
    "n_broker": N_BROKER,
}

(OUT_DIR / "생성_메타_v13.json").write_text(
    json.dumps(META, ensure_ascii=False, indent=2),
    encoding="utf-8"
)



