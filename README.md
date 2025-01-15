# WhisperTranscriptionWebInterface
React/TypeScript/NodeJS front end for Whisper. Transcribes audio and video (english or french) into text and provides a basic interface for grouping the transcribed text into logical groupings (typically speakers).

Whisper is an Open Source project from Open AI (https://openai.com/index/whisper/) and is on GitHub with an MIT license (https://github.com/openai/whisper/blob/main/LICENSE).

It does all the hard work of transcribing and is as good as any automated transcripts that I have seen.

I ran accross a need to do text transcriptions on files that I wanted tight control over and no Internet access to and it only took a couple of hours to install it and do a simple proof-of-concept from the command line.

Putting a web front-end on it just makes it easier to use within our household and also provides a place to so some simple organizing of the raw, transcribed data.

I used the same audio file for testing that Whisper has on it's website (https://cdn.openai.com/whisper/draft-20220913a/micro-machines.wav). It is a great snippet to test with; it is rather amusing to hear and a great test of a transcription platform.
