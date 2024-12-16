import React, { useState } from "react";
import { ReactMic } from "react-mic";
import { diffWords } from "diff";
import leven from "leven";
import WebAudioAnalyzer from "web-audio-analyser";
import { pipeline } from "@huggingface/transformers";

// Al-Fatiha reference text
const AL_FATIHA_TEXT = [
  "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
  "الرَّحْمَٰنِ الرَّحِيمِ",
  "مَالِكِ يَوْمِ الدِّينِ",
  "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
  "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
  "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
];

const AlFatihaChecker = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [mistakes, setMistakes] = useState([]);
  const [audioBlobURL, setAudioBlobURL] = useState("");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);

  // Start recording
  const startRecording = () => {
    setIsRecording(true);
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
  };

  // Handle microphone stop
  const onStopMic = async (recordedBlob) => {
    setAudioBlobURL(recordedBlob.blobURL);
    const audioBuffer = await fetchAudioBuffer(recordedBlob.blob);
    const maddFeedback = analyzeMadd(audioBuffer);
    const ghunnahFeedback = analyzeGhunnah(audioBuffer);
    const waqfFeedback = analyzeWaqf(audioBuffer);
    const qalqalahFeedback = analyzeQalqalah(audioBuffer); // Qalqalah analysis
    const sakinahFeedback = analyzeSakinah(audioBuffer); // Sakinah analysis

    setFeedback(
      maddFeedback,
      ghunnahFeedback,
      waqfFeedback,
      qalqalahFeedback,
      sakinahFeedback
    );

    const transcriptionText = await transcribeAudio(recordedBlob.blob);
    setTranscription(transcriptionText);
    checkMistakes(transcriptionText);
    calculateScore(transcriptionText); // Calculate score after transcription
  };

  // Analyze Madd using Web Audio API
  const analyzeMadd = (audioBuffer) => {
    const vowelDurationThreshold = 0.5;
    const analyzer = new WebAudioAnalyzer(audioBuffer);
    const vowelDurations = analyzer.getVowelDurations();

    const elongatedVowels = vowelDurations.filter(
      (duration) => duration > vowelDurationThreshold
    );

    return elongatedVowels.length > 0 ? "Correct Madd" : "Incorrect Madd";
  };

  // Analyze Ghunnah (nasalization)
  const analyzeGhunnah = (audioBuffer) => {
    const nasalSounds = ["م", "ن"];
    const analyzer = new WebAudioAnalyzer(audioBuffer);
    const nasalDuration = analyzer.getNasalDuration(nasalSounds);

    return nasalDuration > 0.3 ? "Correct Ghunnah" : "Incorrect Ghunnah";
  };

  // Analyze Waqf (stopping)
  const analyzeWaqf = (audioBuffer) => {
    const analyzer = new WebAudioAnalyzer(audioBuffer);
    const waqfDetected = analyzer.getWaqfErrors();

    return waqfDetected ? "Correct Waqf" : "Incorrect Waqf";
  };

  // Analyze Qalqalah (Echoing)
  const analyzeQalqalah = (audioBuffer) => {
    const qalqalahLetters = ["ق", "ط", "ب", "ج", "د"];
    const analyzer = new WebAudioAnalyzer(audioBuffer);
    const qalqalahDetected = analyzer.getEchoingSounds(qalqalahLetters); // Hypothetical method

    return qalqalahDetected ? "Correct Qalqalah" : "Incorrect Qalqalah";
  };

  // Analyze Sakinah (Silent Letters)
  const analyzeSakinah = (audioBuffer) => {
    const sakinahLetters = ["ه", "ء"];
    const analyzer = new WebAudioAnalyzer(audioBuffer);
    const sakinahDetected = analyzer.getSilentLetters(sakinahLetters); // Hypothetical method

    return sakinahDetected ? "Correct Sakinah" : "Incorrect Sakinah";
  };

  // Transcribe audio using Wav2Vec2
  const transcribeAudio = async (audioBlob) => {
    const asr = pipeline(
      "automatic-speech-recognition",
      "facebook/wav2vec2-large-xlsr-53-arabic"
    );
    const transcription = await asr(audioBlob);
    return transcription.text;
  };

  // Convert Blob to AudioBuffer
  const fetchAudioBuffer = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    return await audioContext.decodeAudioData(arrayBuffer);
  };

  // Highlight mistakes using diffWords
  const checkMistakes = (userText) => {
    const mistakesList = AL_FATIHA_TEXT.map((correctLine, index) => {
      const userLine = userText.split("\n")[index] || "";
      const differences = diffWords(correctLine, userLine);

      return {
        line: correctLine,
        user: userLine,
        differences,
      };
    });

    setMistakes(mistakesList);
  };

  // Calculate score based on Levenshtein distance
  const calculateScore = (userText) => {
    let totalErrors = 0;
    let totalWords = 0;

    AL_FATIHA_TEXT.forEach((line, index) => {
      const userLine = userText.split("\n")[index] || "";
      const levenshteinErrors = leven(line, userLine);
      totalErrors += levenshteinErrors;
      totalWords += line.split(" ").length;
    });

    const accuracy = ((totalWords - totalErrors) / totalWords) * 100;

    // Apply penalties for Tajweed mistakes
    const maddPenalty = feedback.includes("Incorrect Madd") ? 5 : 0;
    const ghunnahPenalty = feedback.includes("Incorrect Ghunnah") ? 5 : 0;
    const waqfPenalty = feedback.includes("Incorrect Waqf") ? 5 : 0;
    const qalqalahPenalty = feedback.includes("Incorrect Qalqalah") ? 5 : 0;
    const sakinahPenalty = feedback.includes("Incorrect Sakinah") ? 5 : 0;

    const finalScore = Math.max(
      0,
      accuracy -
        maddPenalty -
        ghunnahPenalty -
        waqfPenalty -
        qalqalahPenalty -
        sakinahPenalty
    );
    setScore(finalScore.toFixed(2));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Al-Fatiha Recitation Checker</h1>
      {/* Microphone Controls */}
      <div>
        <ReactMic
          record={isRecording}
          onStop={onStopMic}
          strokeColor="#000000"
          backgroundColor="#FF4081"
        />
        <button onClick={startRecording} disabled={isRecording}>
          Start Reciting
        </button>
        <button onClick={stopRecording} disabled={!isRecording}>
          Stop
        </button>
      </div>
      {/* Audio Playback */}
      {audioBlobURL && (
        <div>
          <h2>Recorded Audio:</h2>
          <audio controls src={audioBlobURL}></audio>
        </div>
      )}
      {/* Tajweed Feedback */}
      {feedback && (
        <div>
          <h2>Tajweed Analysis Feedback:</h2>
          <p>{feedback}</p>
        </div>
      )}
      {/* Transcription */}
      <div>
        <h2>Your Transcription:</h2>
        <p>
          {transcription || "Start reciting to see your transcription here."}
        </p>
      </div>
      {/* Mistakes Analysis */}
      <div>
        <h2>Analysis:</h2>
        {mistakes.length === 0 ? (
          <p style={{ color: "black" }}>Recite to see your result here.</p>
        ) : (
          mistakes.map((item, index) => (
            <div key={index} style={{ marginBottom: "20px" }}>
              <p>
                <strong>Line {index + 1}:</strong>{" "}
                {item.differences.map((part, i) => (
                  <span
                    key={i}
                    style={{
                      color: part.added
                        ? "red" // Red for added/extra text
                        : part.removed
                        ? "red" // Red for removed text
                        : "green", // Green for correct text
                    }}
                  >
                    {part.value}
                  </span>
                ))}
              </p>
            </div>
          ))
        )}
      </div>
      ;{/* Final Score */}
      <div>
        <h2>Your Score:</h2>
        <p>{score ? score : "Recite and submit to see your score."}</p>
      </div>
    </div>
  );
};

export default AlFatihaChecker;
