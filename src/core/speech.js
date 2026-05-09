const AUDIO_CACHE_VERSION = "v24";

export async function playWordAudio(wordItem, environment = globalThis) {
  if (!wordItem?.word) {
    return false;
  }

  if (wordItem.audio && environment?.Audio) {
    try {
      const audio = new environment.Audio(resolveAudioPath(wordItem.audio));
      audio.preload = "auto";
      await audio.play();
      return true;
    } catch {
      warnAudioFallback(wordItem, environment);
      return getTtsFallback(environment)(wordItem.word, environment);
    }
  }

  return getTtsFallback(environment)(wordItem.word, environment);
}

export function speakWord(word, environment = globalThis) {
  const synthesis = environment?.speechSynthesis;
  const Utterance = environment?.SpeechSynthesisUtterance;

  if (!word || !synthesis || !Utterance) {
    return false;
  }

  const utterance = new Utterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.75;
  utterance.pitch = 1;
  utterance.volume = 1;

  synthesis.cancel();
  synthesis.speak(utterance);
  return true;
}

function resolveAudioPath(audioPath) {
  if (audioPath.startsWith("assets/")) {
    return `./src/${audioPath}?${AUDIO_CACHE_VERSION}`;
  }

  return audioPath;
}

function getTtsFallback(environment) {
  return environment?.speakWord ?? speakWord;
}

function warnAudioFallback(wordItem, environment) {
  if (environment?.console?.warn) {
    environment.console.warn("Local word audio failed; falling back to TTS.", {
      word: wordItem.word,
      wordId: wordItem.id,
      audio: wordItem.audio,
    });
  }
}
