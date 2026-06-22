import { ref, watch } from 'vue';

const SOUND_KEY = 'ai-sync:sound';

function defaultPlaySound() {
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch { /* audio unavailable — ignore */ }
}

function bodyFor(status) {
  return status === 'question' ? 'Un agent attend ton input' : 'Travail terminé';
}

export function useNotifications(transitions, questionCount, {
  notifier = globalThis.Notification,
  storage = globalThis.localStorage,
  doc = globalThis.document,
  playSound = defaultPlaySound,
} = {}) {
  const permission = ref(notifier ? notifier.permission : 'unsupported');
  const soundOn = ref(storage?.getItem(SOUND_KEY) === '1');

  async function requestPermission() {
    if (!notifier) return;
    permission.value = await notifier.requestPermission();
  }
  function toggleSound() {
    soundOn.value = !soundOn.value;
    storage?.setItem(SOUND_KEY, soundOn.value ? '1' : '0');
  }

  watch(transitions, (list) => {
    if (!list || list.length === 0) return;
    if (notifier && permission.value === 'granted') {
      for (const t of list) new notifier(`${t.name} → ${t.status}`, { body: bodyFor(t.status) });
    }
    if (soundOn.value) playSound();
  });

  watch(questionCount, (n) => {
    if (doc) doc.title = n > 0 ? `(${n}) ai-sync board` : 'ai-sync board';
  }, { immediate: true });

  return { permission, soundOn, requestPermission, toggleSound };
}
