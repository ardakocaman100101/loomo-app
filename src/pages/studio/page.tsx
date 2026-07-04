import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { useSong } from "@/features/data";
import { useSongMetadata } from "@/features/data/library";
import { getSynthStub, Synth, InstrumentName } from "@/features/synth";
import gmInstruments from "@/features/synth/instruments";
import { songToMidiBytes } from "@/features/studio/midi-encoder";
import { parseMidi } from "@/features/parsers";
import * as persistence from "@/features/persist/persistence";
import midiState from "@/features/midi";
import { bytesToBase64 } from "@/utils";
import { useEventListener } from "@/hooks";
import { mutate } from "swr";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Download,
  ArrowLeft,
  Volume2,
  Music,
  Piano,
  Sliders,
  X,
  PlusCircle,
  FileMusic,
  SlidersHorizontal,
  Sparkles,
  Target,
  SkipBack,
  SkipForward,
  Repeat,
} from "lucide-react";
import type { Song, SongNote, Track, Tracks, SongSource } from "@/types";
import { Logo } from "@/icons";

// Pitch helpers
const ROW_HEIGHT = 28; // px

const isBlackKey = (midiNote: number) => {
  const noteInOctave = midiNote % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave); // C#, D#, F#, G#, A#
};

const getNoteName = (midiNote: number) => {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${names[midiNote % 12]}${octave}`;
};

// Default BPM & Duration for sketches
const DEFAULT_BPM = 120;
const DEFAULT_DURATION = 32; // seconds (8 measures at 120 bpm, 4/4)

export default function Studio() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get("id");
  const source = searchParams.get("source") as SongSource | null;

  // SWR hook to fetch existing song only when an ID/source is provided
  const { data: loadedSong, isLoading } = useSong(id ?? undefined, source ?? undefined);
  const songMeta = id && source ? useSongMetadata(id, source) : undefined;

  // Core state
  const [songName, setSongName] = useState("Untitled Song");
  const [isLooping, setIsLooping] = useState(false);
  const [notes, setNotes] = useState<SongNote[]>([]);
  const [tracks, setTracks] = useState<Tracks>({
    0: { name: "Piano Melody", instrument: "acoustic_grand_piano", program: 0 },
  });
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [activeTrack, setActiveTrack] = useState<number>(0);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [clipboardNote, setClipboardNote] = useState<SongNote | null>(null);

  const [instrumentRange, setInstrumentRange] = useState(midiState.detectedRange);
  useEffect(() => {
    const interval = setInterval(() => {
      if (midiState.detectedRange !== instrumentRange) {
        setInstrumentRange(midiState.detectedRange);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [instrumentRange]);

  const { minMidi, maxMidi } = useMemo(() => {
    let songStart = 60;
    let songEnd = 60;
    if (notes.length > 0) {
      songStart = Math.min(...notes.map((n) => n.midiNote));
      songEnd = Math.max(...notes.map((n) => n.midiNote));
    }

    let start = 36;
    let end = 96;

    let k = 0;
    if (songStart < start || songEnd > end) {
      const shiftDown = Math.ceil((start - songStart) / 12);
      const shiftUp = Math.ceil((songEnd - end) / 12);
      
      if (shiftDown > 0 && shiftUp <= 0) {
        k = -shiftDown;
      } else if (shiftUp > 0 && shiftDown <= 0) {
        k = shiftUp;
      } else {
        const songCenter = (songStart + songEnd) / 2;
        const instrumentCenter = (start + end) / 2;
        k = Math.round((songCenter - instrumentCenter) / 12);
      }
    }

    const minK = Math.ceil((21 - start) / 12);
    const maxK = Math.floor((108 - end) / 12);
    k = Math.max(minK, Math.min(maxK, k));

    return {
      minMidi: start + k * 12,
      maxMidi: end + k * 12,
    };
  }, [notes]);
  
  // History for Undo/Redo
  const [history, setHistory] = useState<{ notes: SongNote[]; tracks: Tracks }[]>([
    {
      notes: [],
      tracks: { 0: { name: "Piano Melody", instrument: "acoustic_grand_piano", program: 0 } },
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Layout states
  const MIN_ZOOM = 8; // minimum px per 16th note
  const MAX_ZOOM = 64; // maximum px per 16th note
  const KEY_WIDTH = 40;
  const KEY_TOP_HEIGHT = 64;
  // Distance (px) from the bottom of the scroll container to the playhead line.
  // Increase this value to move the baseline higher, which makes the note visually
  // touch the line closer to the moment the audio fires.
  const PLAYHEAD_BOTTOM = 80;
  const [zoomY, setZoomY] = useState<number>(32);
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      // deltaY > 0 means zoom out, <0 zoom in
      setZoomY(prev => {
        const step = -e.deltaY * 0.05; // adjust sensitivity
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + step));
        return newZoom;
      });
    }
  };

  // Sync piano horizontal scroll with grid horizontal scroll
  const handleGridScroll = useCallback(() => {
    if (pianoScrollRef.current && scrollContainerRef.current) {
      pianoScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set());
  const [soloTracks, setSoloTracks] = useState<Set<number>>(new Set());

  // Refs for loop playback
  const playbackIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const playbackTimeRef = useRef<number>(0);
  const lastTimePlayedRef = useRef<number>(0);
  const synthCacheRef = useRef<{ [trackId: number]: Synth }>({});
  const activeNotesMapRef = useRef<Map<string, { note: SongNote; synth: Synth }>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pianoScrollRef = useRef<HTMLDivElement>(null);
  const scrollInitializedRef = useRef(false);

  // Set initial scroll position after layout is computed.
  // useLayoutEffect runs synchronously after DOM paint, so clientHeight is always valid.
  // We also guard: if a song is being loaded (id present), wait until notes are populated.
  useLayoutEffect(() => {
    if (isLoading) return;
    if (scrollInitializedRef.current) return;
    const el = scrollContainerRef.current;
    if (!el || el.clientHeight === 0) return;
    // When loading an existing song, defer until notes are actually in state
    if (id && notes.length === 0) return;

    // Horizontal: scroll to the lowest note pitch
    let targetMidi = 60;
    if (notes.length > 0) {
      targetMidi = Math.min(...notes.map((n) => n.midiNote));
    }
    const hOffset = Math.max(0, (targetMidi - minMidi - 2) * KEY_WIDTH);
    el.scrollLeft = hOffset;
    if (pianoScrollRef.current) pianoScrollRef.current.scrollLeft = hOffset;

    // Vertical: position so t=0 sits at the playhead (PLAYHEAD_BOTTOM px from bottom).
    // With inverted Y, gridY(t=0) = gridH. We need:
    //   scrollTop + (containerH - PLAYHEAD_BOTTOM) = gridH  =>  scrollTop = gridH - containerH + PLAYHEAD_BOTTOM
    const containerH = el.clientHeight;
    const maxNoteEnd = notes.length > 0 ? Math.max(...notes.map(n => n.time + n.duration)) : 0;
    const computedTotalDur = Math.max(DEFAULT_DURATION, Math.ceil(maxNoteEnd + 4));
    const gridH = Math.ceil(computedTotalDur * (bpm / 60) * 4) * zoomY;
    el.scrollTop = Math.max(0, gridH - containerH + PLAYHEAD_BOTTOM);

    scrollInitializedRef.current = true;
  });

  // On window resize: keep the scroll offset relative to the bottom constant
  // so the baseline stays aligned.
  useEffect(() => {
    let lastH = 0;
    const onResize = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const newH = el.clientHeight;
      const diff = newH - lastH;
      if (diff !== 0 && lastH !== 0) {
        el.scrollTop = Math.max(0, el.scrollTop - diff);
      }
      lastH = newH;
    };
    window.addEventListener('resize', onResize);
    setTimeout(() => { if (scrollContainerRef.current) lastH = scrollContainerRef.current.clientHeight; }, 200);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Undo/Redo tracking helper
  const pushHistory = useCallback((newNotes: SongNote[], newTracks: Tracks) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ notes: JSON.parse(JSON.stringify(newNotes)), tracks: { ...newTracks } });
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, [history, historyIndex]);

  // Synchronize synths when tracks mapping changes
  useEffect(() => {
    Object.entries(tracks).forEach(([idStr, t]) => {
      const trackId = Number(idStr);
      const instrument = (t.instrument as InstrumentName) || "acoustic_grand_piano";
      if (!synthCacheRef.current[trackId] || synthCacheRef.current[trackId].getInstrument() !== instrument) {
        synthCacheRef.current[trackId] = getSynthStub(instrument);
      }
    });
  }, [tracks]);

  // Load song into local state if editing an existing song
  useEffect(() => {
    if (loadedSong) {
      // Reset scroll so it re-initializes with the real notes after this render
      scrollInitializedRef.current = false;
      setSongName(songMeta?.title || "Untitled Song");
      setNotes(loadedSong.notes || []);
      setTracks(loadedSong.tracks || {
        0: { name: "Melody", instrument: "acoustic_grand_piano", program: 0 },
      });
      if (loadedSong.bpms && loadedSong.bpms.length > 0) {
        setBpm(loadedSong.bpms[0].bpm);
      }
      
      // Initialize history
      const initialHistory = [{ notes: JSON.parse(JSON.stringify(loadedSong.notes || [])), tracks: { ...loadedSong.tracks } }];
      setHistory(initialHistory);
      setHistoryIndex(0);
    } else if (!id) {
      // Setup blank sketch history
      const initialNotes: SongNote[] = [];
      const initialTracks = {
        0: { name: "Piano Melody", instrument: "acoustic_grand_piano" as InstrumentName, program: 0 },
      };
      setHistory([{ notes: initialNotes, tracks: initialTracks }]);
      setHistoryIndex(0);
    }
  }, [loadedSong, id, songMeta]);

  // Playback timer scheduler
  const stopAllNotes = useCallback(() => {
    activeNotesMapRef.current.forEach((active) => {
      try {
        active.synth.stopNote(active.note.midiNote);
      } catch (e) {
        console.error(e);
      }
    });
    activeNotesMapRef.current.clear();
  }, []);

  const totalDuration = useMemo(() => {
    if (notes.length === 0) return DEFAULT_DURATION;
    const maxTime = Math.max(...notes.map((n) => n.time + n.duration));
    return Math.max(DEFAULT_DURATION, Math.ceil(maxTime + 4));
  }, [notes]);

  const tick = useCallback(() => {
    const now = performance.now() / 1000;
    let elapsed = now - startTimeRef.current;
    
    // Check for loop end
    if (elapsed >= totalDuration) {
      if (isLooping) {
        startTimeRef.current = now;
        lastTimePlayedRef.current = 0;
        setPlaybackTime(0);
        playbackTimeRef.current = 0;
        stopAllNotes();
        elapsed = 0;
      } else {
        setIsPlaying(false);
        startTimeRef.current = now;
        lastTimePlayedRef.current = 0;
        setPlaybackTime(0);
        playbackTimeRef.current = 0;
        stopAllNotes();
        return;
      }
    }

    setPlaybackTime(elapsed);
    playbackTimeRef.current = elapsed;

    const current = elapsed;
    const last = lastTimePlayedRef.current;

    notes.forEach((note) => {
      const noteStart = note.time;
      const noteEnd = note.time + note.duration;
      const noteKey = `${note.track}-${note.midiNote}-${note.time}`;

      // Play note
      if (noteStart >= last && noteStart < current) {
        const isMuted = mutedTracks.has(note.track);
        const hasSolo = soloTracks.size > 0;
        const isSolo = soloTracks.has(note.track);
        const shouldPlay = hasSolo ? isSolo : !isMuted;

        if (shouldPlay) {
          const synth = synthCacheRef.current[note.track];
          if (synth) {
            synth.playNote(note.midiNote, note.velocity || 80);
            activeNotesMapRef.current.set(noteKey, { note, synth });
          }
        }
      }

      // Stop note
      if (activeNotesMapRef.current.has(noteKey) && current >= noteEnd) {
        const active = activeNotesMapRef.current.get(noteKey);
        if (active) {
          active.synth.stopNote(note.midiNote);
          activeNotesMapRef.current.delete(noteKey);
        }
      }
    });

    lastTimePlayedRef.current = current;
    playbackIntervalRef.current = requestAnimationFrame(tick);
  }, [notes, totalDuration, mutedTracks, soloTracks, stopAllNotes, isLooping]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playbackIntervalRef.current) {
        cancelAnimationFrame(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      stopAllNotes();
    } else {
      setIsPlaying(true);
      startTimeRef.current = performance.now() / 1000 - playbackTime;
      lastTimePlayedRef.current = playbackTime;
      playbackIntervalRef.current = requestAnimationFrame(tick);
    }
  }, [isPlaying, playbackTime, tick, stopAllNotes]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) {
      cancelAnimationFrame(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    stopAllNotes();
    setPlaybackTime(0);
    playbackTimeRef.current = 0;
    lastTimePlayedRef.current = 0;
  }, [stopAllNotes]);

  const seekTo = useCallback((t: number) => {
    const cappedT = Math.max(0, Math.min(totalDuration, t));
    setPlaybackTime(cappedT);
    playbackTimeRef.current = cappedT;
    lastTimePlayedRef.current = cappedT;
    if (isPlaying) {
      startTimeRef.current = performance.now() / 1000 - cappedT;
    }
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const playheadY = containerHeight - PLAYHEAD_BOTTOM;
      const factor = (bpm / 60) * 4 * zoomY;
      const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY;
      const noteY = gridH - cappedT * factor;
      scrollContainerRef.current.scrollTop = Math.max(0, noteY - playheadY);
    }
  }, [isPlaying, bpm, zoomY, totalDuration, PLAYHEAD_BOTTOM]);

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        cancelAnimationFrame(playbackIntervalRef.current);
      }
    };
  }, []);

  useEventListener<KeyboardEvent>("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    // Playback
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayback();
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(0);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(totalDuration);
      return;
    }

    // Delete
    if ((e.key === "Delete" || e.key === "Backspace") && selectedNoteIndex !== null) {
      e.preventDefault();
      deleteNote(selectedNoteIndex);
      return;
    }

    // Undo / Redo
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copy
      if (key === "c" && selectedNoteIndex !== null) {
        e.preventDefault();
        setClipboardNote(notes[selectedNoteIndex]);
        return;
      }

      // Paste
      if (key === "v" && clipboardNote) {
        e.preventDefault();
        const newNote = { ...clipboardNote, time: playbackTime };
        const updatedNotes = [...notes, newNote];
        setNotes(updatedNotes);
        setSelectedNoteIndex(updatedNotes.length - 1);
        pushHistory(updatedNotes, tracks);
        return;
      }
    }
  });

  // Physical MIDI and PC keyboard input support
  useEffect(() => {
    const handleMidiEvent = (e: import("@/types").MidiStateEvent) => {
      const synth = synthCacheRef.current[activeTrack];
      if (!synth) return;
      if (e.type === "down" && e.note !== undefined) {
        synth.playNote(e.note, e.velocity || 80);
      } else if (e.type === "up" && e.note !== undefined) {
        synth.stopNote(e.note);
      }
    };
    midiState.subscribe(handleMidiEvent);
    return () => midiState.unsubscribe(handleMidiEvent);
  }, [activeTrack]);

  // Time & Pixel coordinates mapping
  // Y is INVERTED: time=0 maps to the BOTTOM of the grid, larger time maps to the TOP.
  // This gives "falling notes" behavior: future notes appear at top and fall toward the piano.
  const timeToY = useCallback((t: number) => {
    const factor = (bpm / 60) * 4 * zoomY;
    const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY;
    return gridH - t * factor;
  }, [bpm, zoomY, totalDuration]);

  // Convert a duration (delta time) to pixels — no offset, just the linear factor
  const durationToHeight = useCallback((d: number) => {
    return d * (bpm / 60) * 4 * zoomY;
  }, [bpm, zoomY]);

  // Auto-scroll during playback: as time increases, scrollTop DECREASES,
  // so the grid scrolls UP and notes appear to FALL DOWNWARD past the fixed playhead.
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return;
    const containerHeight = scrollContainerRef.current.clientHeight;
    const playheadY = containerHeight - PLAYHEAD_BOTTOM; // playhead is PLAYHEAD_BOTTOM px from bottom
    const factor = (bpm / 60) * 4 * zoomY;
    const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY;
    const noteY = gridH - playbackTime * factor; // inverted Y of current time
    scrollContainerRef.current.scrollTop = Math.max(0, noteY - playheadY);
  }, [playbackTime, isPlaying, bpm, zoomY, totalDuration]);

  // Inverted yToTime for the falling-notes coordinate system
  const yToTime = useCallback((y: number) => {
    const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY;
    return (gridH - y) / ((bpm / 60) * 4 * zoomY);
  }, [bpm, zoomY, totalDuration]);

  // Subdivision time helper
  const getSubdivisionTime = useCallback((subdivision: number) => {
    return subdivision * (60 / bpm / 4);
  }, [bpm]);

  // Click key handlers
  const handleKeyMouseDown = (midiNote: number) => {
    const synth = synthCacheRef.current[activeTrack];
    if (synth) {
      synth.playNote(midiNote, 90);
    }
  };

  const handleKeyMouseUp = (midiNote: number) => {
    const synth = synthCacheRef.current[activeTrack];
    if (synth) {
      synth.stopNote(midiNote);
    }
  };

  // Add / Edit / Remove Note operations
  const addNoteAt = (midiNote: number, timeSubdivision: number) => {
    const noteTime = getSubdivisionTime(timeSubdivision);
    const noteDuration = 60 / bpm; // default 1 beat duration
    const newNote: SongNote = {
      type: "note",
      midiNote,
      track: activeTrack,
      time: noteTime,
      duration: noteDuration,
      velocity: 80,
      measure: Math.floor(timeSubdivision / 16) + 1,
    };

    // Play feedback
    const synth = synthCacheRef.current[activeTrack];
    if (synth) {
      synth.playNote(midiNote, 80);
      setTimeout(() => synth.stopNote(midiNote), 200);
    }

    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    setSelectedNoteIndex(updatedNotes.length - 1);
    pushHistory(updatedNotes, tracks);
  };

  const handleNoteClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedNoteIndex(index);
  };

  const handleNoteDoubleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    deleteNote(index);
  };

  const deleteNote = (index: number) => {
    const updatedNotes = notes.filter((_, i) => i !== index);
    setNotes(updatedNotes);
    setSelectedNoteIndex(null);
    pushHistory(updatedNotes, tracks);
  };

  // Drag and Resize handlers
  const dragRef = useRef<{
    noteIndex: number;
    startX: number;
    startY: number;
    startTime: number;
    startMidi: number;
    isResize: boolean;
    startDuration: number;
  } | null>(null);

  const handleNoteMouseDown = (e: React.MouseEvent, index: number, isResize: boolean) => {
    e.stopPropagation();
    const note = notes[index];
    dragRef.current = {
      noteIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      startTime: note.time,
      startMidi: note.midiNote,
      isResize,
      startDuration: note.duration,
    };
    setSelectedNoteIndex(index);

    window.addEventListener("mousemove", handleNoteMouseMove);
    window.addEventListener("mouseup", handleNoteMouseUp);
  };

  const handleNoteMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const { noteIndex, startX, startY, startTime, startMidi, isResize, startDuration } = dragRef.current;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Inverted Y: dragging DOWN = moving toward earlier time (negative deltaTime)
    const deltaSubdivisions = Math.round(deltaY / zoomY);
    const deltaTime = -deltaSubdivisions * (60 / bpm / 4);

    const updatedNotes = [...notes];
    const note = { ...updatedNotes[noteIndex] };

    if (isResize) {
      // Resize handle is at TOP of note (future end). Drag UP = longer, drag DOWN = shorter.
      const newDuration = Math.max(60 / bpm / 4, startDuration - deltaTime);
      note.duration = newDuration;
    } else {
      // Moving
      const newTime = Math.max(0, startTime + deltaTime);
      const deltaKeys = Math.round(deltaX / KEY_WIDTH);
      const newMidi = Math.min(maxMidi, Math.max(minMidi, startMidi + deltaKeys));
      
      // Play audio feedback on pitch change
      if (newMidi !== note.midiNote) {
        const synth = synthCacheRef.current[note.track];
        if (synth) {
          synth.playNote(newMidi, 80);
          setTimeout(() => synth.stopNote(newMidi), 150);
        }
      }

      note.time = newTime;
      note.midiNote = newMidi;
      note.measure = Math.floor((newTime * (bpm / 60) * 4) / 16) + 1;
    }

    updatedNotes[noteIndex] = note;
    setNotes(updatedNotes);
  };

  const handleNoteMouseUp = () => {
    if (dragRef.current) {
      pushHistory(notes, tracks);
    }
    dragRef.current = null;
    window.removeEventListener("mousemove", handleNoteMouseMove);
    window.removeEventListener("mouseup", handleNoteMouseUp);
  };

  // Undo / Redo triggers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNotes(prev.notes);
      setTracks(prev.tracks);
      setHistoryIndex(historyIndex - 1);
      setSelectedNoteIndex(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNotes(next.notes);
      setTracks(next.tracks);
      setHistoryIndex(historyIndex + 1);
      setSelectedNoteIndex(null);
    }
  };

  // Track panel controls
  const addTrack = () => {
    const trackIds = Object.keys(tracks).map(Number);
    const nextId = trackIds.length > 0 ? Math.max(...trackIds) + 1 : 0;
    const newTracks = {
      ...tracks,
      [nextId]: {
        name: `Track ${nextId + 1}`,
        instrument: "electric_piano_1",
        program: 4,
      },
    };
    setTracks(newTracks);
    setActiveTrack(nextId);
    pushHistory(notes, newTracks);
  };

  const deleteTrack = (trackId: number) => {
    const newTracks = { ...tracks };
    delete newTracks[trackId];
    
    // Also clear notes for this track
    const newNotes = notes.filter((n) => n.track !== trackId);
    
    setTracks(newTracks);
    setNotes(newNotes);
    setActiveTrack(Object.keys(newTracks).map(Number)[0] || 0);
    pushHistory(newNotes, newTracks);
  };

  const updateTrackInstrument = (trackId: number, instrument: InstrumentName) => {
    const program = gmInstruments.indexOf(instrument);
    const newTracks = {
      ...tracks,
      [trackId]: {
        ...tracks[trackId],
        instrument,
        program: program !== -1 ? program : 0,
      },
    };
    setTracks(newTracks);
    pushHistory(notes, newTracks);
  };

  const updateTrackName = (trackId: number, name: string) => {
    const newTracks = {
      ...tracks,
      [trackId]: {
        ...tracks[trackId],
        name,
      },
    };
    setTracks(newTracks);
  };

  const toggleMute = (trackId: number) => {
    const newMuted = new Set(mutedTracks);
    if (newMuted.has(trackId)) {
      newMuted.delete(trackId);
    } else {
      newMuted.add(trackId);
      // Remove solo if muted
      const newSolo = new Set(soloTracks);
      newSolo.delete(trackId);
      setSoloTracks(newSolo);
    }
    setMutedTracks(newMuted);
  };

  const toggleSolo = (trackId: number) => {
    const newSolo = new Set(soloTracks);
    if (newSolo.has(trackId)) {
      newSolo.delete(trackId);
    } else {
      newSolo.add(trackId);
      // Unmute if soloed
      const newMuted = new Set(mutedTracks);
      newMuted.delete(trackId);
      setMutedTracks(newMuted);
    }
    setSoloTracks(newSolo);
  };

  // Save changes and return to Practice/Play mode
  const handleSaveAndPractice = (practiceTrackId?: number) => {
    stopPlayback();
    
    const targetId = id || crypto.randomUUID();
    const targetSource = source || "upload";

    // Build the partial Song structure to encode
    const editedSong: Partial<Song> = {
      tracks,
      notes,
      bpms: [{ time: 0, bpm }],
      timeSignature: { numerator: 4, denominator: 4 },
      keySignature: "C",
      ppq: 480,
      secondsToTicks: (s) => Math.round(s * 480 * (bpm / 60)), // dummy mappings for the compiler
      ticksToSeconds: (t) => t / (480 * (bpm / 60)),
    };

    try {
      const midiBytes = songToMidiBytes(editedSong);
      const base64Data = bytesToBase64(midiBytes);
      
      if (!id) {
        // If sketching, register as uploaded song
        persistence.registerCustomSketch(targetId, songName, totalDuration);
      }
      
      // Store in caching layer
      persistence.saveEditedMidi(targetId, base64Data);

      // Clear old settings so play mode correctly re-evaluates the new track structures
      persistence.clearPersistedSongSettings(targetId);

      // Update SWR cache directly to avoid useSWRImmutable showing stale data
      const parsedSong = parseMidi(midiBytes as any);
      mutate([targetId, targetSource], parsedSong, { revalidate: false });

      // Redirect
      const queryParams = new URLSearchParams();
      queryParams.set("id", targetId);
      queryParams.set("source", targetSource);
      if (practiceTrackId !== undefined) {
        queryParams.set("practiceTrackId", String(practiceTrackId));
      }
      navigate(`/play?${queryParams.toString()}`);
    } catch (e) {
      console.error("Failed to compile midi bytes", e);
      alert("Error saving song. Please check console.");
    }
  };

  // Download MIDI file (.mid)
  const handleDownloadMIDI = () => {
    const editedSong: Partial<Song> = {
      tracks,
      notes,
      bpms: [{ time: 0, bpm }],
      timeSignature: { numerator: 4, denominator: 4 },
      keySignature: "C",
      ppq: 480,
    };

    try {
      const midiBytes = songToMidiBytes(editedSong);
      const blob = new Blob([midiBytes as any], { type: "audio/midi" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${songName.toLowerCase().replace(/\s+/g, "_")}.mid`;
      link.click();
    } catch (e) {
      console.error(e);
      alert("Error generating MIDI file.");
    }
  };

  // Preset sketch templates
  const applyTemplate = (type: "simple" | "duet" | "sketch") => {
    let t: Tracks = {};
    let n: SongNote[] = [];
    if (type === "simple") {
      t = { 0: { name: "Piano", instrument: "acoustic_grand_piano", program: 0 } };
    } else if (type === "duet") {
      t = {
        0: { name: "Melody (Synth)", instrument: "lead_1_square", program: 80 },
        1: { name: "Bassline", instrument: "electric_bass_finger", program: 33 },
      };
    } else if (type === "sketch") {
      t = {
        0: { name: "EP Keyboard", instrument: "electric_piano_1", program: 4 },
        1: { name: "Lead Guitar", instrument: "electric_guitar_clean", program: 27 },
      };
    }
    setTracks(t);
    setNotes(n);
    setActiveTrack(0);
    setHistory([{ notes: n, tracks: t }]);
    setHistoryIndex(0);
  };

  // Piano roll vertical scroll keyboard setup
  const pianoKeys = useMemo(() => {
    const keys = [];
    for (let m = minMidi; m <= maxMidi; m++) {
      keys.push(m);
    }
    return keys;
  }, [minMidi, maxMidi]);

  const totalGridWidth = useMemo(() => pianoKeys.length * KEY_WIDTH, [pianoKeys.length]);
  const totalGridHeight = useMemo(() => {
    const totalSubdivisions = Math.ceil(totalDuration * (bpm / 60) * 4);
    return totalSubdivisions * zoomY;
  }, [totalDuration, bpm, zoomY]);

  // CSS variables for background repeating grid lines
  const gridBackgroundStyle = useMemo(() => {
    return {
      "--zoomY": `${zoomY}px`,
      backgroundImage: `
        repeating-linear-gradient(180deg, rgba(229, 226, 225, 0.03) 0px, rgba(229, 226, 225, 0.03) 1px, transparent 1px, transparent var(--zoomY)),
        repeating-linear-gradient(180deg, rgba(229, 226, 225, 0.08) 0px, rgba(229, 226, 225, 0.08) 1px, transparent 1px, transparent calc(var(--zoomY) * 4)),
        repeating-linear-gradient(180deg, rgba(208, 188, 255, 0.2) 0px, rgba(208, 188, 255, 0.2) 2px, transparent 2px, transparent calc(var(--zoomY) * 16)),
        repeating-linear-gradient(90deg, rgba(229, 226, 225, 0.03) 0px, rgba(229, 226, 225, 0.03) 1px, transparent 1px, transparent ${KEY_WIDTH}px)
      `,
      backgroundSize: `${KEY_WIDTH}px auto`,
    } as React.CSSProperties;
  }, [zoomY]);

  // Selected note details
  const selectedNote = selectedNoteIndex !== null ? notes[selectedNoteIndex] : null;

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="bg-[#131313] text-[#e5e2e1] select-none font-sans"
    >
      {/* Studio Header (Loomo look-alike) */}
      <header className="flex h-20 items-center justify-between border-b border-[#353534]/50 bg-[#131313] px-6 shadow-md z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              stopPlayback();
              navigate(-1);
            }}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10 text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all text-[#d0bcff]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          
          <div className="h-6 w-[1px] bg-[#353534]" />

          <div className="flex items-center gap-3">
            <Link to="/" onClick={() => stopPlayback()} className="flex items-center gap-2 group mr-2">
              <Logo height={32} width={50} className="w-[50px] h-8 shadow-[0_0_20px_rgba(160,120,255,0.4)] group-hover:scale-105 transition-all cursor-pointer" />
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#d0bcff] transition-all cursor-pointer">loomo</span>
            </Link>
            <input
              type="text"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              className="bg-transparent text-xl font-bold tracking-tight text-[#e5e2e1] focus:outline-none focus:border-b focus:border-[#d0bcff]"
            />
          </div>
        </div>

        {/* Playback Controls & BPM */}
        <div className="flex items-center gap-6 rounded-2xl glass-card px-6 py-2 border border-[#d0bcff]/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => seekTo(0)}
              title="Skip to Beginning"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[#e5e2e1]/80 hover:text-white"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlayback}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                isPlaying ? "bg-[#d0bcff] text-[#131313]" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={stopPlayback}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
            <button
              onClick={() => seekTo(totalDuration)}
              title="Skip to End"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[#e5e2e1]/80 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              title="Toggle Loop"
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                isLooping ? "bg-[#d0bcff]/20 text-[#d0bcff] border border-[#d0bcff]/30" : "bg-white/5 hover:bg-white/10 text-[#e5e2e1]/80"
              }`}
            >
              <Repeat className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-[1px] bg-[#353534]" />

          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#cbc3d7]">Tempo:</span>
            <input
              type="number"
              value={bpm}
              min={40}
              max={280}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-14 rounded-lg bg-white/5 py-1 text-center font-semibold text-[#d0bcff] focus:outline-none border border-white/5"
            />
            <span className="text-[#cbc3d7] font-light">BPM</span>
          </div>

          <div className="h-6 w-[1px] bg-[#353534]" />

          <div className="text-xs font-mono tabular-nums text-white/60">
            {playbackTime.toFixed(2)}s / {totalDuration}s
          </div>
        </div>

        {/* Editor Save / History / Download */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 border border-white/5">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 className="h-4 w-4 text-[#e5e2e1]" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 className="h-4 w-4 text-[#e5e2e1]" />
            </button>
          </div>

          <button
            onClick={handleDownloadMIDI}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 transition-all text-sm font-medium border border-white/15"
          >
            <Download className="h-4 w-4 text-[#cbc3d7]" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => handleSaveAndPractice()}
            className="flex items-center gap-2 rounded-xl bg-[#a078ff] px-5 py-2 text-white font-semibold shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:shadow-[0_0_25px_rgba(160,120,255,0.6)] hover:bg-[#b088ff] active:scale-95 transition-all text-sm"
          >
            <Save className="h-4 w-4" />
            <span>Play</span>
          </button>
        </div>
      </header>

      {/* Main Studio Work Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}
      >
        
        {/* Left Track Manager (Loomo Theme) */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex h-full flex-col border-r border-[#353534]/50 bg-[#171717] overflow-hidden select-none"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#353534]/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#cbc3d7]">Tracks</span>
                <button
                  onClick={addTrack}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#d0bcff] hover:text-[#b088ff] px-2 py-1 bg-[#d0bcff]/5 rounded-lg border border-[#d0bcff]/10 hover:bg-[#d0bcff]/10"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {/* Scrollable Track list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {Object.entries(tracks).map(([idStr, track]) => {
                  const trackId = Number(idStr);
                  const isActive = activeTrack === trackId;
                  const isMuted = mutedTracks.has(trackId);
                  const isSolo = soloTracks.has(trackId);

                  return (
                    <div
                      key={trackId}
                      onClick={() => setActiveTrack(trackId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#202020] border-[#d0bcff]/30 shadow-[0_0_15px_rgba(208,188,255,0.05)]"
                          : "bg-white/3 border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={track.name || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateTrackName(trackId, e.target.value)}
                          className="bg-transparent text-sm font-semibold text-[#e5e2e1] focus:outline-none focus:border-b focus:border-[#d0bcff] w-3/4"
                        />
                        {Object.keys(tracks).length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTrack(trackId);
                            }}
                            className="p-1 rounded-md text-red-400/75 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Instrument selection drop down */}
                        <select
                          value={track.instrument || "acoustic_grand_piano"}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateTrackInstrument(trackId, e.target.value as InstrumentName)}
                          className="bg-[#292929] border border-white/5 rounded-lg text-xs text-[#cbc3d7] px-2 py-1 outline-none w-3/5"
                        >
                          {gmInstruments.map((inst) => (
                            <option key={inst} value={inst}>
                              {inst.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>

                        {/* Mute/Solo button controllers */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute(trackId);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isMuted
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
                            }`}
                          >
                            M
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSolo(trackId);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isSolo
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
                            }`}
                          >
                            S
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveAndPractice(trackId);
                            }}
                            title="Practice this Track"
                            className="p-1 rounded bg-white/5 text-white/50 border border-white/10 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <Target className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sketch template presets */}
              {notes.length === 0 && (
                <div className="p-4 border-t border-[#353534]/30 space-y-3 bg-[#131313]/50">
                  <span className="text-[10px] uppercase font-bold text-[#cbc3d7]/60 tracking-wider">Presets Sketches</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => applyTemplate("simple")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-1.5 font-medium text-center transition-colors"
                    >
                      Solo Piano
                    </button>
                    <button
                      onClick={() => applyTemplate("duet")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-1.5 font-medium text-center transition-colors"
                    >
                      Synth/Bass
                    </button>
                    <button
                      onClick={() => applyTemplate("sketch")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-1.5 font-medium text-center transition-colors"
                    >
                      EP/Guitar
                    </button>
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle Handle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-[280px] top-1/2 -translate-y-1/2 z-40 h-16 w-3.5 bg-[#171717] border border-l-0 border-[#353534]/50 rounded-r-lg flex items-center justify-center hover:bg-[#202020] cursor-pointer text-[#cbc3d7]"
          style={{ left: sidebarOpen ? "280px" : "0px" }}
        >
          <SlidersHorizontal className="h-2 w-2 rotate-90" />
        </button>

        {/* Right panel — position:relative so children can be absolutely placed */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#1a1a1a' }}>

          {/* Timeline bar — pinned to top */}
          <div
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32 }}
            className="border-b border-[#353534]/30 bg-[#131313] flex items-center justify-between px-4 text-xs select-none"
          >
            <span className="text-[#cbc3d7]/60 text-[10px] uppercase font-semibold">Timeline</span>
            <div className="flex items-center gap-3">
              <span className="text-[#cbc3d7]">Zoom:</span>
              <div className="flex rounded-md bg-white/5 p-0.5 border border-white/5">
                {[12, 16, 24, 32].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoomY(z)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      zoomY === z ? "bg-[#d0bcff] text-[#131313]" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {z === 12 ? "S" : z === 16 ? "M" : z === 24 ? "L" : "XL"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid viewport — fills space between timeline and piano (+ optional note details) */}
          <div
            style={{
              position: 'absolute',
              top: 32,
              bottom: selectedNote ? KEY_TOP_HEIGHT + 80 : KEY_TOP_HEIGHT,
              left: 0,
              right: 0,
              overflow: 'hidden',
            }}
          >
            {/* Playhead line — always 32px from the bottom of this viewport */}
            <div
              className="pointer-events-none absolute left-0 right-0 h-[2px] bg-[#d0bcff] shadow-[0_0_8px_#d0bcff] z-50"
              style={{ bottom: PLAYHEAD_BOTTOM }}
            />

            {/* Scrollable note grid */}
            <div
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
              ref={scrollContainerRef}
              onWheel={handleWheel}
              onScroll={handleGridScroll}
            >
              {/* Grid canvas */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const clickY = e.clientY - rect.top;
                  const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY;
                  const timeSubdivision = Math.floor((gridH - clickY) / zoomY);
                  const noteMidi = Math.min(maxMidi, Math.max(minMidi, minMidi + Math.floor(clickX / KEY_WIDTH)));
                  addNoteAt(noteMidi, timeSubdivision);
                }}
                className="relative cursor-crosshair select-none bg-[#131313]"
                style={{ ...gridBackgroundStyle, width: `${totalGridWidth}px`, height: `${totalGridHeight}px` }}
              >
                {notes.map((note, index) => {
                  const isSelected = selectedNoteIndex === index;
                  const isNoteActive = note.track === activeTrack;
                  const isMuted = mutedTracks.has(note.track);
                  const hasSolo = soloTracks.size > 0;
                  const isSolo = soloTracks.has(note.track);
                  const isVisible = hasSolo ? isSolo : !isMuted;
                  if (!isVisible) return null;

                  const left = (note.midiNote - minMidi) * KEY_WIDTH;
                  const top = timeToY(note.time + note.duration);
                  const height = Math.max(20, durationToHeight(note.duration));
                  const velocityFactor = (note.velocity || 80) / 127;

                  return (
                    <div
                      key={index}
                      onMouseDown={(e) => handleNoteMouseDown(e, index, false)}
                      onClick={(e) => handleNoteClick(e, index)}
                      onDoubleClick={(e) => handleNoteDoubleClick(e, index)}
                      className={`absolute rounded-xl border cursor-move select-none flex flex-col justify-between px-1 transition-shadow ${
                        isSelected
                          ? 'border-white bg-[#d0bcff] text-[#131313] shadow-[0_0_15px_rgba(208,188,255,0.9)] z-10'
                          : isNoteActive
                            ? 'border-[#d0bcff]/40 bg-[#a078ff]/80 text-white'
                            : 'border-white/10 bg-white/20 text-white/70'
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${KEY_WIDTH}px`,
                        top: `${top}px`,
                        height: `${height}px`,
                        opacity: isSelected ? 1 : 0.4 + velocityFactor * 0.6,
                      }}
                    >
                      <span className="text-[9px] font-bold truncate leading-none">{getNoteName(note.midiNote)}</span>
                      <div
                        onMouseDown={(e) => handleNoteMouseDown(e, index, true)}
                        className="absolute top-0 left-0 h-2 w-full cursor-ns-resize rounded-t-xl hover:bg-white/30"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Note details panel — sits just above piano when a note is selected */}
          {selectedNote && (
            <div
              style={{ position: 'absolute', bottom: KEY_TOP_HEIGHT, left: 0, right: 0, height: 80 }}
              className="bg-[#171717] border-t border-[#353534]/50 px-6 flex items-center justify-between z-20"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#cbc3d7]">Pitch:</span>
                  <span className="text-sm font-bold text-[#d0bcff]">{getNoteName(selectedNote.midiNote)}</span>
                </div>
                <div className="h-6 w-[1px] bg-[#353534]" />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#cbc3d7]">Velocity:</span>
                  <input
                    type="range" min={1} max={127}
                    value={selectedNote.velocity || 80}
                    onChange={(e) => {
                      const updated = [...notes];
                      updated[selectedNoteIndex!] = { ...selectedNote, velocity: Number(e.target.value) };
                      setNotes(updated);
                      pushHistory(updated, tracks);
                    }}
                    className="w-32 accent-[#d0bcff] cursor-pointer"
                  />
                  <span className="text-sm font-mono text-[#d0bcff] w-6">{selectedNote.velocity || 80}</span>
                </div>
                <div className="h-6 w-[1px] bg-[#353534]" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#cbc3d7]">Duration:</span>
                  <span className="text-sm font-mono text-[#d0bcff]">{selectedNote.duration.toFixed(2)}s</span>
                </div>
              </div>
              <button
                onClick={() => deleteNote(selectedNoteIndex!)}
                className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl px-4 py-2 border border-red-500/20 text-xs font-semibold active:scale-95 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Note
              </button>
            </div>
          )}

          {/* Piano keys — always pinned to the very bottom */}
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: KEY_TOP_HEIGHT }}
            className="overflow-hidden border-t border-[#353534] bg-[#1e1e1e]"
            ref={pianoScrollRef}
          >
            <div className="flex" style={{ width: `${totalGridWidth}px`, height: '100%' }}>
              {pianoKeys.map((key) => {
                const isBlack = isBlackKey(key);
                return (
                  <div
                    key={key}
                    onMouseDown={() => handleKeyMouseDown(key)}
                    onMouseUp={() => handleKeyMouseUp(key)}
                    onMouseLeave={() => handleKeyMouseUp(key)}
                    className={`relative flex h-full flex-col justify-end pb-1.5 px-0.5 cursor-pointer transition-colors active:bg-[#a078ff]/30 ${
                      isBlack
                        ? 'bg-[#121212] border-r border-black/45 shadow-[inset_0_-8px_16px_rgba(255,255,255,0.01),inset_0_1px_2px_rgba(0,0,0,0.85)]'
                        : 'bg-[#FAF9F6] border-r border-[#d4cfc5]/35 shadow-[inset_0_-6px_12px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                    }`}
                    style={{ minWidth: `${KEY_WIDTH}px`, width: `${KEY_WIDTH}px` }}
                  >
                    <span
                      className={`font-mono text-[8.5px] font-medium tracking-tighter text-center w-full uppercase ${
                        isBlack ? 'text-[#FAF9F6]/25' : 'text-[#131313]/40'
                      }`}
                    >
                      {getNoteName(key)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
