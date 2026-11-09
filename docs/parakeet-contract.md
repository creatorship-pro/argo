# Transcription server contract (A3, S7)

The FDE iPad records a guest's turn in short segments (about 45 seconds, each a complete audio file). The app's `/api/transcribe` route passes each segment to the transcription server and returns the text. Only the text is stored. Until the server exists, the app uses a stub that returns obviously fake text.

The server (Parakeet 0.6B) needs to match this:

```
POST {PARAKEET_URL}/transcribe
Authorization: Bearer {PARAKEET_TOKEN}      (sent only if PARAKEET_TOKEN is set)
Content-Type: audio/mp4                      (or audio/webm, audio/ogg: the iPad's own type; do not assume one)
Body: the audio bytes

200 OK
Content-Type: application/json
{"text": "the transcript of this segment"}

Any other status = failure. The app keeps the audio on the iPad and tries again.
```

Notes for whoever builds it:

- Segments are independent files, so each can be decoded on its own. Expect m4a/AAC from Safari.
- The app sends one segment at a time per iPad, so about five at once during the breakout. Aim for at least 5x real time, ideally 10x.
- Do not log audio or transcript text. Do not keep audio after answering.
- Parakeet v3 covers 25 European languages. If guests speak others, Whisper is the fallback behind the same contract.
- Still to test on the real server (ticket S4, folded into A3): a real five-minute conversation recorded on the iPad in a noisy room, then five uploads at once, measuring speed and accuracy.
