import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from './types';

const PROFILE_KEY = 'toranut.profile.v1';
const TOKEN_KEY = 'toranut.token.v1';
const MINE_KEY = 'toranut.mine.v1';

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(p: Profile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

function randomToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  const arr = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
  for (const b of arr) out += chars[b % chars.length];
  return out;
}

/** Secret per-device token that proves ownership of requests this device posted. */
export async function getOwnerToken(): Promise<string> {
  try {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    if (t) return t;
    const fresh = randomToken();
    await AsyncStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return randomToken();
  }
}

export async function loadMyIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveMyIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MINE_KEY, JSON.stringify(ids));
  } catch {}
}
