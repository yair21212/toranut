import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { verifyCode } from './api';
import { C, FONT } from './theme';

/** "I'm one of us" check, styled like a not-a-robot box, then a 4-digit access code. */
export default function Gate({ onPass }: { onPass: (code: string) => void }) {
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const input = useRef<TextInput>(null);
  const expand = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (opened) {
      Animated.timing(expand, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      setTimeout(() => input.current?.focus(), 280);
    }
  }, [opened, expand]);

  const doShake = () => {
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 3, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: false }))
    ).start();
  };

  const submit = async (value: string) => {
    if (value.length < 4 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyCode(value);
      if (res === 'ok') {
        setPassed(true);
        setTimeout(() => onPass(value), 550);
        return;
      }
      setErr(res === 'too_many_attempts' ? 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' : 'הקוד לא נכון. בקשו אותו בקבוצה.');
      setCode('');
      doShake();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, 4);
    setCode(digits);
    setErr(null);
    if (digits.length === 4) submit(digits);
  };

  return (
    <View style={s.page}>
      <View style={s.container}>
        <Text style={s.kicker}>החלפות תורנויות</Text>
        <Text style={s.h1}>רגע לפני שנכנסים</Text>
        <Text style={s.lead}>האתר מיועד רק לחברי הקבוצה, כדי שהשמות והמספרים יישארו בינינו.</Text>

        <Animated.View style={[s.box, { transform: [{ translateX: shake }] }]}>
          <Pressable
            onPress={() => !opened && setOpened(true)}
            style={s.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: passed }}
          >
            <View style={[s.check, opened && !passed && s.checkActive, passed && s.checkDone]}>
              {passed ? (
                <Text style={s.checkMark}>✓</Text>
              ) : busy ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : null}
            </View>
            <Text style={s.rowText}>אני מהחבר׳ה</Text>
            <View style={s.badge}>
              <Text style={s.badgeIcon}>🔒</Text>
              <Text style={s.badgeText}>בדיקת גישה</Text>
            </View>
          </Pressable>

          <Animated.View
            style={{
              overflow: 'hidden',
              maxHeight: expand.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }),
              opacity: expand,
            }}
          >
            <View style={s.divider} />
            <Text style={s.codeLabel}>{passed ? 'ברוכים הבאים!' : 'הכניסו את קוד הכניסה'}</Text>
            <Pressable onPress={() => input.current?.focus()} style={s.digits}>
              {[0, 1, 2, 3].map((i) => {
                const ch = code[i];
                const active = !passed && i === code.length;
                return (
                  <View key={i} style={[s.digit, active && s.digitActive, passed && s.digitDone, err && s.digitErr]}>
                    <Text style={[s.digitText, passed && { color: '#fff' }]}>{ch ?? ''}</Text>
                  </View>
                );
              })}
            </Pressable>
            <TextInput
              ref={input}
              value={code}
              onChangeText={onChange}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              editable={!busy && !passed}
              style={s.hiddenInput}
              caretHidden
            />
            {err ? <Text style={s.err}>{err}</Text> : <Text style={s.hint}>את הקוד מקבלים בקבוצה.</Text>}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const T = { fontFamily: FONT, color: C.ink };
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 28, justifyContent: 'center' },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: -60 },
  kicker: { ...T, color: C.muted, fontSize: 14, marginBottom: 2 },
  h1: { ...T, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  lead: { ...T, color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 22 },
  box: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6D1C4',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#B9B4A8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { borderColor: C.accent },
  checkDone: { backgroundColor: C.accent, borderColor: C.accent },
  checkMark: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  rowText: { ...T, flex: 1, fontSize: 17, fontWeight: '500' },
  badge: { alignItems: 'center', gap: 1 },
  badgeIcon: { fontSize: 22 },
  badgeText: { ...T, color: C.muted, fontSize: 10 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  codeLabel: { ...T, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  digits: { flexDirection: 'row', justifyContent: 'center', gap: 10, direction: 'ltr' } as any,
  digit: {
    width: 52,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: '#FBFAF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitActive: { borderColor: C.accent },
  digitDone: { backgroundColor: C.accent, borderColor: C.accent },
  digitErr: { borderColor: C.danger },
  digitText: { ...T, fontSize: 26, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: 0, left: 0 },
  err: { ...T, color: C.danger, fontSize: 14, textAlign: 'center', marginTop: 12 },
  hint: { ...T, color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
