import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, fromISO, toISO, todayISO, WEEK_HEADERS } from './dates';
import { C, FONT } from './theme';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const MAX_MONTHS_AHEAD = 12;

type Props = {
  selected: string[];
  onToggle: (iso: string) => void;
  color: string;
  disabled?: string[];
  hint?: string[]; // dates to mark with a dot
};

/** Month calendar with next/previous month navigation, from today up to a year ahead. */
export default function DateGrid({ selected, onToggle, color, disabled = [], hint = [] }: Props) {
  const today = todayISO();
  const lastDay = addDays(today, 365);
  const [offset, setOffset] = useState(() => {
    // open on the month of the first selected date, if any
    if (selected[0]) {
      const s = fromISO(selected[0]);
      const t = fromISO(today);
      return Math.max(0, (s.getFullYear() - t.getFullYear()) * 12 + s.getMonth() - t.getMonth());
    }
    return 0;
  });

  const { year, month, weeks } = useMemo(() => {
    const t = fromISO(today);
    const first = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(y, m, d)));
    while (cells.length % 7) cells.push(null);
    const out: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return { year: y, month: m, weeks: out };
  }, [offset, today]);

  const canPrev = offset > 0;
  const canNext = offset < MAX_MONTHS_AHEAD;

  return (
    <View style={s.wrap}>
      <View style={s.nav}>
        <Pressable
          onPress={() => canPrev && setOffset((o) => o - 1)}
          disabled={!canPrev}
          style={[s.navBtn, !canPrev && s.navBtnOff]}
          hitSlop={8}
          accessibilityLabel="חודש קודם"
        >
          <Text style={[s.navArrow, !canPrev && { color: '#C9C4B8' }]}>›</Text>
        </Pressable>
        <View style={s.monthWrap}>
          <View style={s.monthNum}>
            <Text style={s.monthNumText}>{month + 1}</Text>
          </View>
          <Text style={s.monthTitle}>
            {MONTHS[month]} {year}
          </Text>
        </View>
        <Pressable
          onPress={() => canNext && setOffset((o) => o + 1)}
          disabled={!canNext}
          style={[s.navBtn, !canNext && s.navBtnOff]}
          hitSlop={8}
          accessibilityLabel="חודש הבא"
        >
          <Text style={[s.navArrow, !canNext && { color: '#C9C4B8' }]}>‹</Text>
        </Pressable>
      </View>

      <View style={s.row}>
        {WEEK_HEADERS.map((h) => (
          <Text key={h} style={s.head}>
            {h}
          </Text>
        ))}
      </View>

      {weeks.map((w, wi) => (
        <View key={wi} style={s.row}>
          {w.map((iso, i) => {
            if (!iso) return <View key={i} style={s.cell} />;
            const past = iso < today || iso > lastDay;
            const isSel = selected.includes(iso);
            const isDis = past || disabled.includes(iso);
            const isHint = hint.includes(iso);
            const isToday = iso === today;
            return (
              <Pressable
                key={iso}
                disabled={isDis}
                onPress={() => onToggle(iso)}
                style={({ pressed }) => [
                  s.cell,
                  s.day,
                  isToday && s.today,
                  isSel && { backgroundColor: color, borderColor: color },
                  isDis && s.dis,
                  pressed && !isSel && { backgroundColor: C.accentSoft },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: isDis }}
              >
                <Text style={[s.num, isSel && { color: '#fff', fontWeight: '700' }, isDis && { color: '#B9B4A8' }]}>
                  {fromISO(iso).getDate()}
                </Text>
                {isHint && <View style={[s.dot, { backgroundColor: isSel ? '#fff' : C.match }]} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      {offset > 0 && (
        <Pressable onPress={() => setOffset(0)} style={s.todayLink} hitSlop={6}>
          <Text style={s.todayLinkText}>חזרה לחודש הנוכחי</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  nav: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FBFAF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { backgroundColor: '#F3F0E8' },
  navArrow: { fontFamily: FONT, fontSize: 28, lineHeight: 30, color: C.ink, marginTop: -3 },
  monthWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  monthNum: {
    minWidth: 40,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNumText: { fontFamily: FONT, fontWeight: '800', fontSize: 18, color: '#fff' },
  monthTitle: { textAlign: 'center', fontFamily: FONT, fontWeight: '700', fontSize: 18, color: C.ink },
  row: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 12, fontFamily: FONT, paddingVertical: 2 },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 48 },
  day: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FBFAF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderColor: C.ink },
  dis: { backgroundColor: '#EFEBE2', borderColor: '#EFEBE2' },
  num: { fontFamily: FONT, fontSize: 15, color: C.ink },
  dot: { width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: 5 },
  todayLink: { alignSelf: 'center', marginTop: 8, paddingVertical: 4 },
  todayLinkText: { fontFamily: FONT, fontSize: 13, color: C.accent, fontWeight: '500' },
});
