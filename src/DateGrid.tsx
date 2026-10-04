import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, dayOfMonth, monthName, todayISO, WEEK_HEADERS, weekday } from './dates';
import { C, FONT } from './theme';

type Props = {
  selected: string[];
  onToggle: (iso: string) => void;
  color: string;
  days?: number;
  disabled?: string[];
  hint?: string[]; // dates to mark with a dot (e.g. dates the other person can take)
};

export default function DateGrid({ selected, onToggle, color, days = 49, disabled = [], hint = [] }: Props) {
  const weeks = useMemo(() => {
    const start = todayISO();
    const lead = weekday(start); // Sunday-first weeks
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let i = 0; i < days; i++) cells.push(addDays(start, i));
    while (cells.length % 7) cells.push(null);
    const out: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [days]);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {WEEK_HEADERS.map((h) => (
          <Text key={h} style={s.head}>
            {h}
          </Text>
        ))}
      </View>
      {weeks.map((w, wi) => {
        const firstReal = w.find((x) => x) as string;
        const showMonth = wi === 0 || w.some((x) => x && dayOfMonth(x) === 1);
        const monthIso = wi === 0 ? firstReal : (w.find((x) => x && dayOfMonth(x) === 1) as string);
        return (
          <View key={wi}>
            {showMonth && <Text style={s.month}>{monthName(monthIso)}</Text>}
            <View style={s.row}>
              {w.map((iso, i) => {
                if (!iso) return <View key={i} style={s.cell} />;
                const isSel = selected.includes(iso);
                const isDis = disabled.includes(iso);
                const isHint = hint.includes(iso);
                const isToday = iso === todayISO();
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
                      {dayOfMonth(iso)}
                    </Text>
                    {isHint && <View style={[s.dot, { backgroundColor: isSel ? '#fff' : C.match }]} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 12, fontFamily: FONT, paddingVertical: 2 },
  month: { fontFamily: FONT, fontWeight: '700', color: C.ink, fontSize: 13, marginTop: 6, marginBottom: 2 },
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
});
