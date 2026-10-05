import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateGrid from './src/DateGrid';
import { CloseReason, closeRequest, createRequest, fetchOpenRequests, logOffer } from './src/api';
import AdminScreen from './src/Admin';
import { formatLong, formatShort, relativeLabel } from './src/dates';
import { displayPhone, normalizePhone, whatsappUrl } from './src/phone';
import { getOwnerToken, loadMyIds, loadProfile, saveMyIds, saveProfile } from './src/storage';
import { C, FONT } from './src/theme';
import { DUTY_COLORS, DUTY_HINTS, DUTY_LABELS, DUTY_ORDER, DutyType, Profile, SwapRequest } from './src/types';

// ---------- web setup: RTL, font, title ----------
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.setAttribute('lang', 'he');
  document.title = 'החלפות תורנויות';
  if (!document.getElementById('heebo-font')) {
    const l = document.createElement('link');
    l.id = 'heebo-font';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap';
    document.head.appendChild(l);
  }
  const meta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', C.bg);
  document.head.appendChild(meta);
  document.body.style.backgroundColor = C.bg;
}

const IS_ADMIN =
  Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin');

type Screen = 'loading' | 'onboarding' | 'home' | 'new';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState('');
  const [myIds, setMyIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<SwapRequest | null>(null);
  const [firstTime, setFirstTime] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await fetchOpenRequests();
      setRequests(rows);
      setListError(null);
    } catch {
      setListError('לא הצלחנו לטעון את הבקשות. בדוק את החיבור לאינטרנט.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [p, t, ids] = await Promise.all([loadProfile(), getOwnerToken(), loadMyIds()]);
      setProfile(p);
      setToken(t);
      setMyIds(ids);
      setScreen(p ? 'home' : 'onboarding');
    })();
    refresh();
    const iv = setInterval(refresh, 30000);
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const mine = useMemo(
    () => requests.filter((r) => myIds.includes(r.id) || (profile !== null && r.phone === profile.phone)),
    [requests, myIds, profile]
  );

  const addMine = useCallback(
    async (id: string) => {
      const next = [...myIds, id];
      setMyIds(next);
      await saveMyIds(next);
    },
    [myIds]
  );

  const updateProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    await saveProfile(p);
  }, []);

  const onClose = useCallback(
    async (r: SwapRequest, reason: CloseReason) => {
      try {
        await closeRequest(r.id, profile?.phone ?? '', reason);
        setRequests((rs) => rs.filter((x) => x.id !== r.id));
        const next = myIds.filter((x) => x !== r.id);
        setMyIds(next);
        await saveMyIds(next);
        showToast(reason === 'swapped' ? 'איזה כיף, מצאת החלפה! הבקשה ירדה מהלוח.' : 'הבקשה הוסרה מהלוח.');
      } catch (e: any) {
        showToast(e.message);
      }
    },
    [profile, myIds, showToast]
  );

  if (IS_ADMIN) return <AdminScreen />;

  if (screen === 'loading') {
    return (
      <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar style="dark" />
      {screen === 'onboarding' && (
        <Onboarding
          initial={profile}
          requests={requests}
          onDone={async (p, returning) => {
            const isNew = !profile && !returning;
            await updateProfile(p);
            setFirstTime(isNew);
            setScreen(isNew ? 'new' : 'home');
          }}
        />
      )}
      {screen === 'home' && profile && (
        <Home
          profile={profile}
          requests={requests}
          mine={mine}
          myIds={myIds}
          loading={loadingList}
          error={listError}
          onRefresh={refresh}
          onNew={() => {
            setFirstTime(false);
            setScreen('new');
          }}
          onEditProfile={() => setScreen('onboarding')}
          onChangeDuty={(d) => updateProfile({ ...profile, dutyType: d })}
          onOffer={setOfferFor}
          onClose={onClose}
        />
      )}
      {screen === 'new' && profile && (
        <NewRequest
          profile={profile}
          mine={mine}
          firstTime={firstTime}
          onCancel={() => setScreen('home')}
          onSubmit={async (dutyType, dutyDate, note) => {
            const id = await createRequest(
              { duty_type: dutyType, duty_date: dutyDate, want_dates: [], note: note || null, name: profile.name, phone: profile.phone },
              token
            );
            await addMine(id);
            if (dutyType !== profile.dutyType) await updateProfile({ ...profile, dutyType });
            await refresh();
            setScreen('home');
            showToast('הבקשה פורסמה! מי שיכול להחליף ישלח לך הודעה בוואטסאפ.');
          }}
        />
      )}
      {offerFor && profile && (
        <OfferModal
          target={offerFor}
          profile={profile}
          mine={mine}
          onDismiss={() => setOfferFor(null)}
          onSent={async (myDate, publish) => {
            const target = offerFor;
            setOfferFor(null);
            if (publish) {
              try {
                const id = await createRequest(
                  {
                    duty_type: target.duty_type,
                    duty_date: myDate,
                    want_dates: [],
                    note: null,
                    name: profile.name,
                    phone: profile.phone,
                  },
                  token
                );
                await addMine(id);
                refresh();
              } catch {}
            }
            showToast('נפתח וואטסאפ עם ההצעה. אם הוא מסכים, אל תשכחו לעדכן את מי שאחראי על התורנויות.');
          }}
        />
      )}
      {toast && (
        <View style={st.toast} pointerEvents="none">
          <Text style={st.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ======================= Onboarding =======================

function Onboarding({
  initial,
  requests,
  onDone,
}: {
  initial: Profile | null;
  requests: SwapRequest[];
  onDone: (p: Profile, returning?: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 'login'>(initial ? 2 : 1);
  const [loginNote, setLoginNote] = useState<string | null>(null);
  const [duty, setDuty] = useState<DutyType | null>(initial?.dutyType ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial ? '0' + initial.phone.slice(3) : '');
  const [err, setErr] = useState<string | null>(null);

  const login = () => {
    const p = normalizePhone(phone);
    if (!p) return setErr('מספר הטלפון לא תקין. צריך מספר נייד, למשל 0541234567.');
    const own = requests.filter((r) => r.phone === p).sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (own.length > 0) {
      onDone({ name: own[0].name, phone: p, dutyType: own[0].duty_type }, true);
      return;
    }
    setLoginNote('לא מצאנו בקשות פתוחות עם המספר הזה. בחרו סוג תורנות והשלימו שם כדי להמשיך.');
    setStep(1);
  };

  const finish = () => {
    const n = name.trim();
    const p = normalizePhone(phone);
    if (!n) return setErr('צריך למלא שם, כדי שידעו מי מציע את ההחלפה.');
    if (!p) return setErr('מספר הטלפון לא תקין. צריך מספר נייד, למשל 0541234567.');
    if (!duty) return setStep(1);
    onDone({ name: n.slice(0, 40), phone: p, dutyType: duty });
  };

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={st.container}>
        {step === 'login' ? (
          <>
            <Pressable onPress={() => setStep(1)} hitSlop={10}>
              <Text style={st.back}>› חזרה</Text>
            </Pressable>
            <Text style={st.h1}>התחברות</Text>
            <Text style={st.lead}>הכניסו את המספר שאיתו נרשמתם, והבקשות שלכם יחזרו להופיע.</Text>
            <Text style={st.label}>מספר נייד</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErr(null);
              }}
              placeholder="05X-XXX-XXXX"
              placeholderTextColor="#9AA19C"
              style={[st.input, { textAlign: 'right' }]}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              maxLength={16}
              onSubmitEditing={login}
            />
            {err && <Text style={st.err}>{err}</Text>}
            <PrimaryButton label="כניסה" onPress={login} style={{ marginTop: 20 }} />
          </>
        ) : step === 1 ? (
          <>
            <Text style={st.kicker}>החלפות תורנויות</Text>
            <Text style={st.h1}>מה אתם מחפשים להחליף?</Text>
            <Text style={st.lead}>תראו רק בקשות מאותו סוג תורנות, כי מחליפים ראש בראש. אפשר לשנות את זה אחר כך.</Text>
            <View style={{ gap: 12, marginTop: 8 }}>
              {DUTY_ORDER.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => {
                    setDuty(d);
                    setStep(2);
                  }}
                  style={({ pressed }) => [
                    st.dutyCard,
                    { borderColor: duty === d ? DUTY_COLORS[d].bg : C.line },
                    pressed && { backgroundColor: DUTY_COLORS[d].soft },
                  ]}
                >
                  <View style={[st.dutySwatch, { backgroundColor: DUTY_COLORS[d].bg }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.dutyTitle}>{DUTY_LABELS[d]}</Text>
                    <Text style={st.dutyHint}>{DUTY_HINTS[d]}</Text>
                  </View>
                  <Text style={st.chev}>‹</Text>
                </Pressable>
              ))}
            </View>
            {loginNote ? (
              <Text style={[st.warn, { marginTop: 16 }]}>{loginNote}</Text>
            ) : (
              <Pressable
                onPress={() => {
                  setErr(null);
                  setStep('login');
                }}
                style={st.loginLink}
              >
                <Text style={st.loginLinkText}>
                  כבר נרשמתם? <Text style={{ color: C.accent, fontWeight: '700' }}>התחברות עם מספר טלפון</Text>
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            {!initial && (
              <Pressable onPress={() => setStep(1)} hitSlop={10}>
                <Text style={st.back}>› חזרה</Text>
              </Pressable>
            )}
            <Text style={st.h1}>{initial ? 'הפרטים שלי' : 'עוד שני פרטים וסיימנו'}</Text>
            <Text style={st.lead}>
              השם והמספר מופיעים על הבקשות שלכם, כדי שמי שרוצה להחליף יוכל לשלוח לכם הודעה בוואטסאפ בלחיצה אחת.
            </Text>
            {initial && duty && (
              <>
                <Text style={st.label}>סוג התורנות</Text>
                <DutyPills value={duty} onChange={setDuty} />
              </>
            )}
            <Text style={st.label}>שם</Text>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setErr(null);
              }}
              placeholder="לדוגמה: נועה כהן"
              placeholderTextColor="#9AA19C"
              style={st.input}
              maxLength={40}
              autoComplete="name"
            />
            <Text style={st.label}>מספר נייד (וואטסאפ)</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErr(null);
              }}
              placeholder="05X-XXX-XXXX"
              placeholderTextColor="#9AA19C"
              style={[st.input, { textAlign: 'right' }]}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              maxLength={16}
            />
            {err && <Text style={st.err}>{err}</Text>}
            <PrimaryButton label={initial ? 'שמירה' : 'בואו נתחיל'} onPress={finish} style={{ marginTop: 20 }} />
            {initial && <GhostButton label="ביטול" onPress={() => onDone(initial)} />}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ======================= Home =======================

function Home(props: {
  profile: Profile;
  requests: SwapRequest[];
  mine: SwapRequest[];
  myIds: string[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNew: () => void;
  onEditProfile: () => void;
  onChangeDuty: (d: DutyType) => void;
  onOffer: (r: SwapRequest) => void;
  onClose: (r: SwapRequest, reason: CloseReason) => void;
}) {
  const { profile, requests, mine, myIds } = props;
  const duty = profile.dutyType;
  const color = DUTY_COLORS[duty];

  const myDatesForDuty = mine.filter((m) => m.duty_type === duty).map((m) => m.duty_date);

  const others = requests
    .filter(
      (r) =>
        r.duty_type === duty &&
        !mine.some((m) => m.id === r.id) &&
        !myDatesForDuty.includes(r.duty_date) // same day as mine: swapping makes no sense
    )
    .sort((a, b) => a.duty_date.localeCompare(b.duty_date));

  const counts = DUTY_ORDER.reduce(
    (acc, d) => {
      const mineD = mine.filter((m) => m.duty_type === d).map((m) => m.duty_date);
      const n = requests.filter((r) => r.duty_type === d && !mine.some((m) => m.id === r.id) && !mineD.includes(r.duty_date)).length;
      return { ...acc, [d]: n };
    },
    {} as Record<DutyType, number>
  );

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.container}>
        <View style={st.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.kicker}>שלום {profile.name.split(' ')[0]}</Text>
            <Text style={st.h1}>החלפות תורנויות</Text>
            {requests.length - mine.length > 0 && (
              <View style={st.liveRow}>
                <View style={st.liveDot} />
                <Text style={st.liveText}>
                  {requests.length - mine.length === 1
                    ? 'בקשת החלפה אחת פתוחה כרגע באתר'
                    : `${requests.length - mine.length} בקשות החלפה פתוחות כרגע באתר`}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={props.onEditProfile} style={st.iconBtn} hitSlop={6} accessibilityLabel="הפרטים שלי">
            <Text style={st.iconBtnText}>הפרטים שלי</Text>
          </Pressable>
        </View>

        <DutyPills value={duty} onChange={props.onChangeDuty} counts={counts} />

        <PrimaryButton
          label={`צריכים החלפה ב${DUTY_LABELS[duty]}? פרסמו בקשה`}
          onPress={props.onNew}
          color={color.bg}
          style={{ marginTop: 16 }}
        />

        {props.mine.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <Text style={st.h2}>הבקשות שלי</Text>
            <View style={{ gap: 10 }}>
              {props.mine.map((m) => (
                <MyRequestCard key={m.id} r={m} onClose={(reason) => props.onClose(m, reason)} />
              ))}
            </View>
          </View>
        )}

        <View style={[st.sectionHead, { marginTop: 28 }]}>
          <Text style={[st.h2, { marginBottom: 0, flex: 1 }]}>מחפשים החלפה ב{DUTY_LABELS[duty]}</Text>
          <Pressable onPress={props.onRefresh} hitSlop={8} style={st.refresh}>
            {props.loading ? <ActivityIndicator size="small" color={C.muted} /> : <Text style={st.refreshText}>רענון ↻</Text>}
          </Pressable>
        </View>

        {props.error && <Text style={[st.err, { marginBottom: 10 }]}>{props.error}</Text>}

        {others.length === 0 && !props.loading && !props.error && (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>
              {myDatesForDuty.length > 0
                ? `עוד אין בקשות ב${DUTY_LABELS[duty]} בימים אחרים`
                : `אין כרגע בקשות פתוחות ב${DUTY_LABELS[duty]}`}
            </Text>
            <Text style={st.emptyText}>
              {myDatesForDuty.length > 0
                ? 'הבקשה שלכם מופיעה בלוח. כשמישהו יראה אותה ויוכל להחליף, הוא ישלח לכם הודעה בוואטסאפ. כדאי לשלוח את הקישור לאתר בקבוצה של הבסיס.'
                : 'פרסמו את הבקשה שלכם, וכל מי שנכנס יראה אותה. כדאי גם לשלוח את הקישור לאתר בקבוצה של הבסיס.'}
            </Text>
          </View>
        )}

        <View style={{ gap: 12 }}>
          {others.map((r) => (
            <RequestCard key={r.id} r={r} onOffer={() => props.onOffer(r)} />
          ))}
        </View>

        <Text style={st.footer}>בקשות שהתאריך שלהן עבר יורדות מהלוח באופן אוטומטי.</Text>
      </View>
    </ScrollView>
  );
}

function DateBadge({ iso, duty }: { iso: string; duty: DutyType }) {
  const c = DUTY_COLORS[duty];
  const rel = relativeLabel(iso);
  return (
    <View style={[st.dateBadge, { backgroundColor: c.soft }]}>
      <Text style={[st.dateBadgeText, { color: c.bg }]}>{formatLong(iso)}</Text>
      {rel && (
        <View style={[st.relTag, { backgroundColor: c.bg }]}>
          <Text style={st.relTagText}>{rel}</Text>
        </View>
      )}
    </View>
  );
}

function RequestCard({ r, onOffer }: { r: SwapRequest; onOffer: () => void }) {
  return (
    <View style={st.card}>
      <View style={{ gap: 6 }}>
        <Text style={st.cardName}>{r.name}</Text>
        <DateBadge iso={r.duty_date} duty={r.duty_type} />
      </View>
      {r.note ? <Text style={st.cardNote}>״{r.note}״</Text> : null}
      <Pressable onPress={onOffer} style={({ pressed }) => [st.waBtn, pressed && { opacity: 0.85 }]}>
        <Text style={st.waBtnText}>הצעת החלפה בוואטסאפ</Text>
      </Pressable>
    </View>
  );
}

function MyRequestCard({ r, onClose }: { r: SwapRequest; onClose: (reason: CloseReason) => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <View style={[st.card, { backgroundColor: '#FBFAF6' }]}>
      <View style={{ gap: 6 }}>
        <Text style={st.cardMetaStrong}>{DUTY_LABELS[r.duty_type]}</Text>
        <DateBadge iso={r.duty_date} duty={r.duty_type} />
      </View>
      {asking ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={st.cardMeta}>למה להוריד את הבקשה?</Text>
          <Pressable onPress={() => onClose('swapped')} style={[st.smallBtn, { backgroundColor: C.accent, borderColor: C.accent }]}>
            <Text style={[st.smallBtnText, { color: '#fff', fontWeight: '700' }]}>מצאתי החלפה ✓</Text>
          </Pressable>
          <Pressable onPress={() => onClose('removed')} style={st.smallBtn}>
            <Text style={st.smallBtnText}>כבר לא צריך החלפה</Text>
          </Pressable>
          <Pressable onPress={() => setAsking(false)} style={{ paddingVertical: 6, alignItems: 'center' }}>
            <Text style={[st.smallBtnText, { color: C.muted }]}>ביטול</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setAsking(true)} style={[st.smallBtn, { marginTop: 12 }]}>
          <Text style={st.smallBtnText}>מצאתי החלפה / להסיר את הבקשה</Text>
        </Pressable>
      )}
    </View>
  );
}

// ======================= New request =======================

function NewRequest({
  profile,
  mine,
  firstTime,
  onCancel,
  onSubmit,
}: {
  profile: Profile;
  mine: SwapRequest[];
  firstTime: boolean;
  onCancel: () => void;
  onSubmit: (d: DutyType, date: string, note: string) => Promise<void>;
}) {
  const [duty, setDuty] = useState<DutyType>(profile.dutyType);
  const [date, setDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const color = DUTY_COLORS[duty].bg;

  const alreadyPosted = mine.filter((m) => m.duty_type === duty).map((m) => m.duty_date);

  const submit = async () => {
    if (!date) return setErr('בחרו את היום שבו יש לכם תורנות.');
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(duty, date, note.trim().slice(0, 200));
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={st.container}>
        {!firstTime ? (
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={st.back}>› חזרה</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onCancel} hitSlop={10} style={st.skipTop}>
            <Text style={st.skipTopText}>רק רוצים להסתכל? דלגו לבקשות של אחרים ‹</Text>
          </Pressable>
        )}
        <Text style={st.h1}>{firstTime ? `באיזה יום יש לכם ${DUTY_LABELS[duty]} שצריך להחליף?` : 'בקשת החלפה חדשה'}</Text>
        {firstTime && (
          <Text style={st.lead}>
            אחרי שתבחרו את היום, תראו את כל מי שמחפש החלפה ב{DUTY_LABELS[duty]} בימים אחרים, ותוכלו להציע להם להחליף בוואטסאפ.
          </Text>
        )}

        {!firstTime && (
          <>
            <Text style={st.label}>סוג התורנות</Text>
            <DutyPills value={duty} onChange={setDuty} />
          </>
        )}

        {!firstTime && <Text style={st.stepTitle}>באיזה יום יש לכם {DUTY_LABELS[duty]}?</Text>}
        <View style={st.panel}>
          <DateGrid
            selected={date ? [date] : []}
            onToggle={(iso) => {
              setDate(iso === date ? null : iso);
              setErr(null);
            }}
            color={color}
            disabled={alreadyPosted}
          />
        </View>
        {date && <Text style={[st.chosen, { color }]}>נבחר: {formatLong(date)}</Text>}

        <Text style={st.stepTitle}>הערה (לא חובה)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="לדוגמה: עדיפות לימי חמישי"
          placeholderTextColor="#9AA19C"
          style={[st.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          maxLength={200}
        />

        <Text style={st.previewNote}>
          הבקשה תופיע עם השם {profile.name} והמספר {displayPhone(profile.phone)}.
        </Text>
        {err && <Text style={st.err}>{err}</Text>}
        <PrimaryButton
          label={busy ? 'מפרסם…' : firstTime ? 'פרסום הבקשה וצפייה בהחלפות' : 'פרסום הבקשה'}
          onPress={submit}
          disabled={busy}
          color={color}
          style={{ marginTop: 12 }}
        />
        {firstTime && <GhostButton label="דילוג, רק לראות בקשות של אחרים" onPress={onCancel} />}
      </View>
    </ScrollView>
  );
}

// ======================= Offer modal =======================

function OfferModal({
  target,
  profile,
  mine,
  onDismiss,
  onSent,
}: {
  target: SwapRequest;
  profile: Profile;
  mine: SwapRequest[];
  onDismiss: () => void;
  onSent: (myDate: string, publish: boolean) => void;
}) {
  const label = DUTY_LABELS[target.duty_type];
  const color = DUTY_COLORS[target.duty_type].bg;
  const myDates = mine
    .filter((m) => m.duty_type === target.duty_type && m.duty_date !== target.duty_date)
    .map((m) => m.duty_date);
  const preferred = myDates[0] ?? null;
  const [myDate, setMyDate] = useState<string | null>(preferred);
  const [showGrid, setShowGrid] = useState(myDates.length === 0);
  const [publish, setPublish] = useState(true);

  const isNewDate = myDate !== null && !myDates.includes(myDate);

  const message = myDate
    ? `היי ${target.name}, ראיתי באתר ההחלפות שיש לך בקשת החלפה ל${label} ב${formatLong(target.duty_date)}.\n` +
      `לי יש ${label} ב${formatLong(myDate)}. מתאים לך להחליף איתי?\n` +
      `${profile.name}`
    : '';

  const send = () => {
    if (!myDate) return;
    Linking.openURL(whatsappUrl(target.phone, message));
    logOffer(target.id, target.duty_type);
    onSent(myDate, isNewDate && publish);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={st.backdrop} onPress={onDismiss} />
      <View style={st.sheetWrap} pointerEvents="box-none">
        <View style={st.sheet}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <View style={st.sheetHandle} />
            <Text style={st.h2}>הצעת החלפה ל{target.name}</Text>
            <Text style={st.lead}>
              ל{target.name} יש {label} ב{formatLong(target.duty_date)}, וצריך להחליף אותו.
            </Text>

            <Text style={st.stepTitle}>באיזה יום יש לך {label}?</Text>
            {myDates.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {myDates.map((d) => (
                  <Toggle
                    key={d}
                    label={formatShort(d)}
                    active={myDate === d}
                    onPress={() => {
                      setMyDate(d);
                      setShowGrid(false);
                    }}
                    color={color}
                  />
                ))}
                <Toggle label="יום אחר" active={showGrid && isNewDate} onPress={() => setShowGrid(true)} color={color} />
              </View>
            )}
            {showGrid && (
              <View style={[st.panel, { marginTop: 10 }]}>
                <DateGrid
                  selected={myDate ? [myDate] : []}
                  onToggle={(iso) => setMyDate(iso)}
                  color={color}
                  disabled={[target.duty_date]}
                />
              </View>
            )}
            {isNewDate && (
              <Pressable onPress={() => setPublish((p) => !p)} style={st.checkRow}>
                <View style={[st.checkbox, publish && { backgroundColor: color, borderColor: color }]}>
                  {publish && <Text style={st.checkMark}>✓</Text>}
                </View>
                <Text style={st.checkLabel}>לפרסם גם את התורנות שלי ב{formatLong(myDate!)} בלוח, כדי שגם אחרים יוכלו להציע לי החלפה</Text>
              </Pressable>
            )}

            {myDate && (
              <View style={st.msgPreview}>
                <Text style={st.msgPreviewLabel}>ההודעה שתישלח:</Text>
                <Text style={st.msgPreviewText}>{message}</Text>
              </View>
            )}

            <Pressable
              onPress={send}
              disabled={!myDate}
              style={({ pressed }) => [st.waBtn, { marginTop: 16, paddingVertical: 15 }, !myDate && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
            >
              <Text style={st.waBtnText}>שליחה בוואטסאפ ל{target.name}</Text>
            </Pressable>
            <GhostButton label="ביטול" onPress={onDismiss} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ======================= small UI pieces =======================

function DutyPills({ value, onChange, counts }: { value: DutyType; onChange: (d: DutyType) => void; counts?: Record<DutyType, number> }) {
  return (
    <View style={st.pills}>
      {DUTY_ORDER.map((d) => {
        const active = d === value;
        const c = DUTY_COLORS[d];
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            style={[st.pill, active ? { backgroundColor: c.bg, borderColor: c.bg } : { backgroundColor: C.card }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[st.pillText, active && { color: '#fff' }]}>{DUTY_LABELS[d]}</Text>
            {counts && counts[d] > 0 && (
              <View style={[st.count, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : c.soft }]}>
                <Text style={[st.countText, { color: active ? '#fff' : c.bg }]}>{counts[d]}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[st.toggle, active && { backgroundColor: color, borderColor: color }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[st.toggleText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  color = C.accent,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [st.primary, { backgroundColor: color }, disabled && { opacity: 0.6 }, pressed && { opacity: 0.88 }, style]}
    >
      <Text style={st.primaryText}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.ghost}>
      <Text style={st.ghostText}>{label}</Text>
    </Pressable>
  );
}

// ======================= styles =======================

const T = { fontFamily: FONT, color: C.ink };

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 60, flexGrow: 1 },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  kicker: { ...T, color: C.muted, fontSize: 14, marginBottom: 2 },
  h1: { ...T, fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  h2: { ...T, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  lead: { ...T, color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  label: { ...T, fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  stepTitle: { ...T, fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  back: { ...T, color: C.accent, fontSize: 15, fontWeight: '500', marginBottom: 10 },
  input: {
    ...T,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  err: { ...T, color: C.danger, fontSize: 14, marginTop: 10, lineHeight: 20 },
  warn: { ...T, color: C.match, fontSize: 13, marginTop: 10, lineHeight: 19 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.card, marginTop: 4 },
  iconBtnText: { ...T, fontSize: 13 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 11,
  },
  pillText: { ...T, fontSize: 15, fontWeight: '700' },
  count: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  countText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  primary: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  primaryText: { fontFamily: FONT, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  ghost: { paddingVertical: 14, alignItems: 'center' },
  ghostText: { ...T, color: C.muted, fontSize: 15 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  refresh: { paddingHorizontal: 6, paddingVertical: 4, minWidth: 60, alignItems: 'flex-end' },
  refreshText: { ...T, color: C.muted, fontSize: 13 },
  empty: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  emptyTitle: { ...T, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyText: { ...T, color: C.muted, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: { ...T, fontSize: 17, fontWeight: '700' },
  cardMeta: { ...T, color: C.muted, fontSize: 14, marginTop: 10, lineHeight: 20 },
  cardMetaStrong: { ...T, fontSize: 15, fontWeight: '700' },
  cardNote: { ...T, fontSize: 14, marginTop: 6, lineHeight: 20 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  dateBadgeText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  relTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  relTagText: { fontFamily: FONT, color: '#fff', fontSize: 12, fontWeight: '700' },
  matchBanner: { backgroundColor: C.matchSoft, marginHorizontal: -16, marginTop: -16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 8 },
  matchText: { ...T, color: C.match, fontSize: 14, fontWeight: '700' },
  waBtn: { backgroundColor: C.whatsapp, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  waBtnText: { fontFamily: FONT, color: '#fff', fontSize: 16, fontWeight: '700' },
  smallBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: C.card },
  smallBtnText: { ...T, fontSize: 14, fontWeight: '500' },
  panel: { backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line },
  panelHint: { ...T, color: C.muted, fontSize: 13, marginBottom: 6 },
  chosen: { fontFamily: FONT, fontSize: 15, fontWeight: '700', marginTop: 10 },
  toggle: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.card },
  toggleText: { ...T, fontSize: 14, fontWeight: '500' },
  previewNote: { ...T, color: C.muted, fontSize: 13, marginTop: 18, lineHeight: 19 },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderWidth: 2,
    borderRadius: 16,
    padding: 18,
  },
  dutySwatch: { width: 14, height: 44, borderRadius: 7 },
  dutyTitle: { ...T, fontSize: 20, fontWeight: '800' },
  dutyHint: { ...T, color: C.muted, fontSize: 14, marginTop: 2 },
  chev: { ...T, color: C.muted, fontSize: 26 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.whatsapp },
  liveText: { ...T, color: C.muted, fontSize: 13 },
  skipTop: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14 },
  skipTopText: { ...T, fontSize: 14, fontWeight: '500', color: C.accent },
  loginLink: { marginTop: 22, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line },
  loginLinkText: { ...T, fontSize: 15, color: C.muted },
  footer: { ...T, color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30 },
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignSelf: 'center',
    maxWidth: 528,
    marginHorizontal: 'auto',
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  toastText: { fontFamily: FONT, color: '#fff', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,26,22,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  checkLabel: { ...T, flex: 1, fontSize: 14, lineHeight: 20 },
  msgPreview: { backgroundColor: '#DCF4E3', borderRadius: 12, padding: 12, marginTop: 16 },
  msgPreviewLabel: { ...T, color: C.muted, fontSize: 12, marginBottom: 4 },
  msgPreviewText: { ...T, fontSize: 14, lineHeight: 21 },
});
