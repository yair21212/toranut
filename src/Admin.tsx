import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminStats, adminSetCode, fetchAdminStats } from './api';
import { C, FONT } from './theme';
import { DUTY_COLORS, DUTY_LABELS, DutyType } from './types';
import { formatShort } from './dates';

const PW_KEY = 'toranut.admin.pw';

export default function AdminScreen() {
  const [pw, setPw] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async (password: string, remember: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const s = await fetchAdminStats(password);
      setStats(s);
      setUpdated(new Date());
      if (remember) await AsyncStorage.setItem(PW_KEY, password).catch(() => {});
    } catch (e: any) {
      setErr(e.message);
      setStats(null);
      await AsyncStorage.removeItem(PW_KEY).catch(() => {});
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'סטטיסטיקות | החלפות תורנויות';
    AsyncStorage.getItem(PW_KEY)
      .then((saved) => {
        if (saved) {
          setPw(saved);
          load(saved, false);
        }
      })
      .catch(() => {});
  }, [load]);

  if (!stats) {
    return (
      <ScrollView contentContainerStyle={a.page} keyboardShouldPersistTaps="handled">
        <View style={a.container}>
          <Text style={a.kicker}>החלפות תורנויות</Text>
          <Text style={a.h1}>כניסת מנהל</Text>
          <TextInput
            value={pw}
            onChangeText={(t) => {
              setPw(t);
              setErr(null);
            }}
            placeholder="סיסמה"
            placeholderTextColor="#9AA19C"
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={() => pw && load(pw, true)}
            style={a.input}
          />
          {err && <Text style={a.err}>{err}</Text>}
          <Pressable onPress={() => pw && load(pw, true)} disabled={busy || !pw} style={[a.btn, (busy || !pw) && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={a.btnText}>כניסה</Text>}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const s = stats;
  const successRate = s.requests_total > 0 ? Math.round((s.swapped / s.requests_total) * 100) : 0;
  const maxDaily = Math.max(1, ...s.daily.map((d) => Math.max(d.requests, d.swapped)));

  return (
    <ScrollView contentContainerStyle={a.page}>
      <View style={a.container}>
        <View style={a.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={a.kicker}>מנהל · החלפות תורנויות</Text>
            <Text style={a.h1}>סטטיסטיקות</Text>
          </View>
          <Pressable onPress={() => load(pw, false)} style={a.refresh} hitSlop={8}>
            {busy ? <ActivityIndicator size="small" color={C.muted} /> : <Text style={a.refreshText}>רענון ↻</Text>}
          </Pressable>
        </View>

        <View style={a.hero}>
          <Text style={a.heroNum}>{s.swapped}</Text>
          <Text style={a.heroLabel}>החלפות שבוצעו דרך האתר</Text>
          <Text style={a.heroSub}>
            {s.swapped_7d} בשבוע האחרון · {successRate}% מהבקשות הסתיימו בהחלפה
          </Text>
        </View>

        <View style={a.grid}>
          <Tile num={s.users} label="משתמשים שפרסמו בקשה" />
          <Tile num={s.requests_total} label="בקשות שפורסמו" sub={`${s.requests_7d} בשבוע האחרון`} />
          <Tile num={s.offers} label="הצעות שנשלחו בוואטסאפ" />
          <Tile num={s.requests_open} label="בקשות פתוחות עכשיו" />
        </View>

        <Text style={a.h2}>לפי סוג תורנות</Text>
        <View style={a.card}>
          <View style={[a.tr, a.thRow]}>
            <Text style={[a.td, a.tdName, a.th]}>תורנות</Text>
            <Text style={[a.td, a.th]}>בקשות</Text>
            <Text style={[a.td, a.th]}>הצעות</Text>
            <Text style={[a.td, a.th]}>הוחלפו</Text>
            <Text style={[a.td, a.th]}>פתוחות</Text>
          </View>
          {s.by_type.map((t) => {
            const c = DUTY_COLORS[t.duty_type as DutyType];
            return (
              <View key={t.duty_type} style={a.tr}>
                <View style={[a.tdName, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <View style={[a.swatch, { backgroundColor: c.bg }]} />
                  <Text style={a.tdText}>{DUTY_LABELS[t.duty_type as DutyType]}</Text>
                </View>
                <Text style={[a.td, a.tdText]}>{t.requests}</Text>
                <Text style={[a.td, a.tdText]}>{t.offers}</Text>
                <Text style={[a.td, a.tdText, { fontWeight: '700', color: C.accent }]}>{t.swapped}</Text>
                <Text style={[a.td, a.tdText]}>{t.open}</Text>
              </View>
            );
          })}
        </View>

        <Text style={a.h2}>14 הימים האחרונים</Text>
        <View style={a.card}>
          <View style={a.legend}>
            <View style={[a.legendDot, { backgroundColor: '#B9C4B0' }]} />
            <Text style={a.legendText}>בקשות חדשות</Text>
            <View style={[a.legendDot, { backgroundColor: C.accent, marginStart: 12 }]} />
            <Text style={a.legendText}>החלפות</Text>
          </View>
          <View style={a.chart}>
            {s.daily.map((d) => (
              <View key={d.day} style={a.col}>
                <View style={a.bars}>
                  <View style={[a.bar, { height: `${(d.requests / maxDaily) * 100}%`, backgroundColor: '#B9C4B0' }]} />
                  <View style={[a.bar, { height: `${(d.swapped / maxDaily) * 100}%`, backgroundColor: C.accent }]} />
                </View>
                <Text style={a.colLabel}>{formatShort(d.day).split(' ')[1]}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={a.h2}>מה קרה לבקשות</Text>
        <View style={a.card}>
          <Row label="נמצאה החלפה" value={s.swapped} />
          <Row label="הוסרו בלי החלפה" value={s.removed} />
          <Row label="עבר התאריך בלי שנסגרו" value={s.expired} />
          <Row label="עדיין פתוחות" value={s.requests_open} last />
        </View>

        <CodeChanger password={pw} />

        <Text style={a.note}>
          "החלפה" נספרת כשמי שפרסם בקשה לוחץ "מצאתי החלפה". בקשות שעבר התאריך שלהן בלי שסגרו אותן לא נספרות, אז המספר האמיתי
          כנראה קצת יותר גבוה. 
          {updated ? `עודכן ב־${updated.getHours()}:${String(updated.getMinutes()).padStart(2, '0')}.` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

function CodeChanger({ password }: { password: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    if (!/^[0-9]{4}$/.test(code)) return setMsg({ ok: false, text: 'הקוד צריך להיות 4 ספרות.' });
    setBusy(true);
    setMsg(null);
    try {
      await adminSetCode(password, code);
      setMsg({ ok: true, text: `הקוד הוחלף ל־${code}. כל מי שמחובר יתבקש להכניס את הקוד החדש.` });
      setCode('');
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Text style={a.h2}>קוד הכניסה</Text>
      <View style={a.card}>
        <Text style={[a.tdText, { color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 10 }]}>
          אם הקוד דלף החוצה, אפשר להחליף אותו כאן. אחרי ההחלפה צריך לפרסם את הקוד החדש בקבוצה.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="קוד חדש (4 ספרות)"
            placeholderTextColor="#9AA19C"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            style={[a.input, { flex: 1, paddingVertical: 10 }]}
          />
          <Pressable onPress={save} disabled={busy} style={[a.btn, { marginTop: 0, paddingHorizontal: 18, paddingVertical: 12 }, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={a.btnText}>החלפה</Text>}
          </Pressable>
        </View>
        {msg && <Text style={[a.tdText, { fontSize: 13, marginTop: 10, color: msg.ok ? C.accent : C.danger }]}>{msg.text}</Text>}
      </View>
    </>
  );
}

function Tile({ num, label, sub }: { num: number; label: string; sub?: string }) {
  return (
    <View style={a.tile}>
      <Text style={a.tileNum}>{num}</Text>
      <Text style={a.tileLabel}>{label}</Text>
      {sub ? <Text style={a.tileSub}>{sub}</Text> : null}
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <View style={[a.row, !last && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
      <Text style={[a.tdText, { flex: 1 }]}>{label}</Text>
      <Text style={[a.tdText, { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const T = { fontFamily: FONT, color: C.ink };
const a = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 60, flexGrow: 1, backgroundColor: C.bg },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { ...T, color: C.muted, fontSize: 14, marginBottom: 2 },
  h1: { ...T, fontSize: 28, fontWeight: '800', marginBottom: 14 },
  h2: { ...T, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  input: { ...T, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  err: { ...T, color: C.danger, marginTop: 10, fontSize: 14 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  btnText: { fontFamily: FONT, color: '#fff', fontSize: 16, fontWeight: '700' },
  refresh: { paddingHorizontal: 6, paddingVertical: 8, minWidth: 60, alignItems: 'flex-end' },
  refreshText: { ...T, color: C.muted, fontSize: 13 },
  hero: { backgroundColor: C.accent, borderRadius: 18, padding: 20 },
  heroNum: { textAlign: 'right', fontFamily: FONT, color: '#fff', fontSize: 52, fontWeight: '800', lineHeight: 58 },
  heroLabel: { fontFamily: FONT, color: '#fff', fontSize: 17, fontWeight: '700' },
  heroSub: { fontFamily: FONT, color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 },
  tileNum: { ...T, textAlign: 'right', fontSize: 28, fontWeight: '800' },
  tileLabel: { ...T, color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  tileSub: { ...T, color: C.muted, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  thRow: { borderBottomWidth: 1, borderBottomColor: C.line, paddingTop: 0 },
  td: { width: 54, textAlign: 'center' },
  tdName: { flex: 1 },
  th: { ...T, color: C.muted, fontSize: 12 },
  tdText: { ...T, fontSize: 15 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...T, color: C.muted, fontSize: 12 },
  chart: { flexDirection: 'row', height: 130, gap: 3, alignItems: 'flex-end' },
  col: { flex: 1, height: '100%', alignItems: 'center' },
  bars: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  bar: { width: '42%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 0 },
  colLabel: { ...T, color: C.muted, fontSize: 9, marginTop: 4 },
  row: { flexDirection: 'row', paddingVertical: 10 },
  note: { ...T, color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
