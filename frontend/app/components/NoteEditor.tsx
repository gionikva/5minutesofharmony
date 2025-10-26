import type { M } from "node_modules/react-router/dist/development/context-DSyS5mLj.mjs";
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * StaffNoteEditor
 * A single-file React + TypeScript component that lets you add musical notes to a treble staff by clicking.
 * - Click anywhere on/near the staff to add a note snapped to the nearest staff position and time grid.
 * - Choose duration (whole/half/quarter/eighth) and accidental (♮/♯/♭) from the toolbar.
 * - Click a note to select it. Press Delete/Backspace or use the Trash button to remove.
 * - Drag horizontally to reposition time; Shift+Drag vertically to change pitch.
 * - Optional: Play button uses a simple WebAudio sine tone to audition notes in order.
 *
 * No external libraries are required. Tailwind classes are used for basic styling; remove or replace as desired.
 */

// === Types ===

type Duration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

type Accidental = "natural" | "sharp" | "flat" | null;

interface StaffNoteEditorProps {
    width?: number;
    height?: number;
    beatWidth?: number; // pixel width for a beat/grid step
    nRows?: number;
    /** Optional initial measures to render */
    initialMeasures?: Measure[];
    onChange?: (notes: ExportedNote[]) => void;
}

// Public export format (friendly names)
export interface ExportedNote {
    id: string;
    pitch: string; // e.g., "C4", "F#5", "Bb4"
    midi: number; // 60 = C4
    duration: Duration;
    x: number;
}

// Backend-friendly Note object shape. We'll send/receive this from the server.
// `value` is an integer quantized duration (ticks). We use 16 ticks = whole note,
// 8 = half, 4 = quarter, 2 = eighth. This keeps everything integer-based for easy
// transport and comparisons. `flourish` is a dictionary of accent/ornament flags.
// `new` indicates whether this note was freshly created on the client.
export interface BackendNote {
    id: string;
    x: number;
    // duration encoded as ticks (int): whole=16, half=8, quarter=4, eighth=2
    duration: number;
    // pitch as a string like "C4", "F#5", "Bb3"
    pitch: string;
    // arbitrary flags describing articulations/accents
    flourish: Record<string, boolean>;
    // whether the note is from an uninitialized measure of rests
    new: boolean;
}

// Convert our local Note -> BackendNote for sending to the server.
function durationToTicks(d: Duration): number {
    switch (d) {
        case "whole":
            return 16;
        case "half":
            return 8;
        case "quarter":
            return 4;
        case "eighth":
            return 2;
        default:
            return 4;
    }
}

export interface Note {
    id: string;
    measure: number;
    tick: number;
    degree: number;
    duration: Duration;
    accidental: Accidental;
}

export type Measure = { id: string; notes: Note[] };

// (noteToBackend is defined after layout helpers so it can compute x using getNoteX)

// === Helpers: music theory-ish mapping ===

// Base reference: degree 0 = E4 (bottom line of treble staff)
const DEGREE_BASE_NOTE = { step: "E" as const, octave: 4 };
const STEPS: Array<"C" | "D" | "E" | "F" | "G" | "A" | "B"> = [
    "C",
    "D",
    "E",
    "F",
    "G",
    "A",
    "B",
];

// Natural semitone offsets from C
const SEMIS_FROM_C: Record<(typeof STEPS)[number], number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

function degreeToStepOctave(degree: number) {
    // Convert a staff degree (E4 = 0) to diatonic step & octave
    const startIndex = STEPS.indexOf(DEGREE_BASE_NOTE.step); // index of E
    const absoluteIndex = startIndex + degree;
    const step = STEPS[mod(absoluteIndex, 7)];
    const octaveDelta = Math.floor((startIndex + degree) / 7);
    const octave = DEGREE_BASE_NOTE.octave + octaveDelta;
    return { step, octave };
}

function stepOctaveToMidi(step: (typeof STEPS)[number], octave: number, acc: Accidental): number {
    // MIDI 60 = C4
    const naturalSemis = SEMIS_FROM_C[step];
    const accidentalOffset = acc === "sharp" ? 1 : acc === "flat" ? -1 : 0;
    const semisFromC0 = naturalSemis + accidentalOffset + (octave * 12);
    return 60 /* C4 */ + (semisFromC0 - (0 + 4 * 12));
}

function degreeAccToPitchString(degree: number, acc: Accidental): string {
    const { step, octave } = degreeToStepOctave(degree);
    const accidentalStr = acc === "sharp" ? "#" : acc === "flat" ? "b" : "";
    return `${step}${accidentalStr}${octave}`;
}

function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// === Component ===

const StaffNoteEditor: React.FC<StaffNoteEditorProps> = ({
    width = 900,
    height = 800,
    beatWidth = 40,
    nRows = 4,
    initialMeasures,
    onChange,
}) => {
    // Layout constants
    const marginLeft = 48; // space for accidentals and left padding
    const marginRight = 24;
    const marginTop = 24;
    const marginBottom = 32;

    const rowMargin = 60


    const staffTop = marginTop + 10;
    const lineGap = 14; // distance between staff lines
    const staffHeight = lineGap * 4 * nRows + rowMargin * (nRows - 1); // distance between top and bottom staff line
    const staffBottom = staffTop + staffHeight;
    const staffLeft = marginLeft;
    const staffRight = width - marginRight;
    const staffMid = (staffTop + staffBottom) / 2;
    const positionStep = lineGap / 2; // each staff degree (line/space)

    // Measures: initialize with 8 logical measures but render up to 80
    const RENDER_MEASURES = 80;
    const INITIAL_MEASURES = 8;
    type Measure = { id: string; notes: Note[] };
    const [measures, setMeasures] = useState<Measure[]>(() =>
        initialMeasures && initialMeasures.length > 0
            ? // ensure each note has correct measure index
              initialMeasures.map((m, mi) => ({ ...m, notes: m.notes.map((n) => ({ ...n, measure: n.measure ?? mi })) }))
            : Array.from({ length: INITIAL_MEASURES }, (_, i) => ({ id: `m${i}`, notes: [] }))
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [toolDuration, setToolDuration] = useState<Duration>("quarter");
    const [toolAcc, setToolAcc] = useState<Accidental>(null);

    // Export callback: flatten measures into exported notes (approximate x)
    useEffect(() => {
        if (!onChange) return;
        const totalTicks = RENDER_MEASURES * 16;
        const totalWidth = staffRight - staffLeft;
        const exported: ExportedNote[] = measures.flatMap((m, mi) =>
            m.notes.map((n) => {
                const { step, octave } = degreeToStepOctave(n.degree);
                const midi = stepOctaveToMidi(step, octave, n.accidental);
                const globalTick = n.measure * 16 + n.tick;
                const x = staffLeft + (globalTick / totalTicks) * totalWidth;
                return {
                    id: n.id,
                    pitch: degreeAccToPitchString(n.degree, n.accidental),
                    midi,
                    duration: n.duration,
                    x,
                };
            })
        );
        onChange(exported);
    }, [measures, onChange]);

    // Map Y => staff degree (nearest line/space)
    const yToDegree = (y: number) => {
        // degree 0 is E4 @ bottom line => y = staffBottom
        const degreesFromBottom = Math.round((staffBottom - y) / positionStep);
        return degreesFromBottom; // positive up, negative down
    };

    // Map degree => Y
    const degreeToY = (degree: number) => staffBottom - degree * positionStep;

    // Tick/grid helpers
    const totalTicks = RENDER_MEASURES * 16;
    const tickWidth = (staffRight - staffLeft) / totalTicks;

    const snapTickFromX = (x: number) => {
        const clamped = Math.max(staffLeft + 1, Math.min(staffRight - 1, x));
        const relative = (clamped - staffLeft) / (staffRight - staffLeft);
        const globalTick = Math.round(relative * totalTicks);
        const measure = Math.floor(globalTick / 16);
        const tick = mod(globalTick, 16);
        return { measure, tick };
    };

    const getNoteX = (measureIndex: number, tick: number) => {
        const globalTick = measureIndex * 16 + tick;
        return staffLeft + globalTick * tickWidth;
    };

    // Now that layout helpers exist, define noteToBackend which converts a Note to the backend shape
    const noteToBackend = (n: Note): BackendNote => ({
        id: n.id,
        x: getNoteX(n.measure, n.tick),
        duration: durationToTicks(n.duration),
        pitch: degreeAccToPitchString(n.degree, n.accidental),
        flourish: {},
        new: true,
    });

    // Ledger lines needed for a degree (beyond the 5-line staff)
    const ledgerLineYs = (degree: number) => {
        // Top line degree = 8 (E5), bottom line degree = 0 (E4)
        const lines: number[] = [];
        if (degree > 8) {
            for (let d = 10; d <= degree; d += 2) lines.push(degreeToY(d));
        } else if (degree < 0) {
            for (let d = -2; d >= degree; d -= 2) lines.push(degreeToY(d));
        }
        return lines;
    };

    // Determine stem direction (simple rule)
    const stemUp = (degree: number) => degree < 6; // below/at B4 => stems up

    // Click on the staff: if a note is selected, move its pitch to the clicked Y
    const handleStaffClick = (evt: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        const svg = evt.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = (evt.target as SVGGraphicsElement).getScreenCTM();
        if (!ctm) return;
        const p = pt.matrixTransform(ctm.inverse());

        // Only operate within staff vertical band
        if (p.y < staffTop - 40 || p.y > staffBottom + 40) return;

        if (!selectedId) return;
        const newDegree = yToDegree(p.y);
        // find note and update its degree
        setMeasures((prev) => {
            const copy = prev.map((m) => ({ ...m, notes: [...m.notes] }));
            for (let mi = 0; mi < copy.length; mi++) {
                const idx = copy[mi].notes.findIndex((n) => n.id === selectedId);
                if (idx >= 0) {
                    copy[mi].notes[idx] = { ...copy[mi].notes[idx], degree: newDegree };
                    break;
                }
            }
            return copy;
        });
    };

    const handleSelectNote = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

    // Keyboard: delete/escape and pitch nudges
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedId(null);
                return;
            }
            if (!selectedId) return;
            setMeasures((prev) => {
                const copy = prev.map((m) => ({ ...m, notes: [...m.notes] }));
                for (let mi = 0; mi < copy.length; mi++) {
                    const idx = copy[mi].notes.findIndex((n) => n.id === selectedId);
                    if (idx >= 0) {
                        const note = copy[mi].notes[idx];
                        if (e.key === "Delete" || e.key === "Backspace") {
                            copy[mi].notes.splice(idx, 1);
                            setSelectedId(null);
                        } else if (e.key === "ArrowUp") {
                            copy[mi].notes[idx] = { ...note, degree: note.degree + 1 };
                        } else if (e.key === "ArrowDown") {
                            copy[mi].notes[idx] = { ...note, degree: note.degree - 1 };
                        }
                        break;
                    }
                }
                return copy;
            });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedId]);

    // No drag behavior: selecting a note is done by clicking it; pitch changes via keyboard or palette.
    const onMouseMove = (_e: React.MouseEvent<SVGSVGElement>) => {};
    const onMouseUp = () => {};

    // Simple playback over flattened measures
    const play = async () => {
        const flat = measures.flatMap((m) => m.notes.map((n) => ({ ...n })));
        if (flat.length === 0) return;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const bpm = 96;
        const secPerBeat = 60 / bpm;
        const now = ctx.currentTime;

        let t = now + 0.05;
        // sort by measure/tick
        flat.sort((a, b) => (a.measure - b.measure) * 16 + (a.tick - b.tick));
        for (const n of flat) {
            const { step, octave } = degreeToStepOctave(n.degree);
            const midi = stepOctaveToMidi(step, octave, n.accidental);
            const freq = midiToFreq(midi);
            const beats = n.duration === "whole" ? 4 : n.duration === "half" ? 2 : n.duration === "quarter" ? 1 : 0.5;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);

            const dur = beats * secPerBeat;
            // quick attack/decay envelope
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            osc.start(t);
            osc.stop(t + dur + 0.02);

            t += dur + 0.05; // small gap
        }
    };

    // Render helpers
    const durationToNotehead = (d: Duration) => ({
        filled: d === "quarter" || d === "eighth",
        showStem: d !== "whole",
        flag: d === "eighth",
    });

    const accidentalGlyph = (a: Accidental) => (a === "sharp" ? "♯" : a === "flat" ? "♭" : a === "natural" ? "♮" : "");

    const toolbarButton = (label: React.ReactNode, active: boolean, onClick: () => void, title?: string) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`px-3 py-1 rounded-2xl text-sm border shadow-sm mx-1 ${active ? "bg-black text-white" : "bg-white hover:bg-gray-50"
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="w-full max-w-full select-none">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Duration</span>
                {toolbarButton("𝅝", toolDuration === "whole", () => setToolDuration("whole"), "Whole note")}
                {toolbarButton("𝅗𝅥", toolDuration === "half", () => setToolDuration("half"), "Half note")}
                {toolbarButton("𝅘𝅥", toolDuration === "quarter", () => setToolDuration("quarter"), "Quarter note")}
                {toolbarButton("𝅘𝅥𝅮", toolDuration === "eighth", () => setToolDuration("eighth"), "Eighth note")}

                <div className="w-px h-6 bg-gray-200 mx-2" />

                <span className="text-xs uppercase tracking-wide text-gray-500">Accidental</span>
                {toolbarButton("♮", toolAcc === "natural", () => setToolAcc("natural"), "Natural")}
                {toolbarButton("♯", toolAcc === "sharp", () => setToolAcc("sharp"), "Sharp")}
                {toolbarButton("♭", toolAcc === "flat", () => setToolAcc("flat"), "Flat")}
                {toolbarButton("—", toolAcc === null, () => setToolAcc(null), "None")}

                <div className="w-px h-6 bg-gray-200 mx-2" />

                <div className="ml-auto" />
                {toolbarButton("Play", false, play, "Play notes left to right")}
                {toolbarButton(
                    "Clear",
                    false,
                    () => setMeasures(Array.from({ length: INITIAL_MEASURES }, (_, i) => ({ id: `m${i}`, notes: [] }))),
                    "Remove all notes"
                )}
            </div>

            {/* Staff + Notes */}
            <svg
                width={width}
                height={height}
                className="bg-white rounded-2xl shadow border"
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onClick={handleStaffClick}
            >
                {/* Staff background */}
                <rect x={0} y={0} width={width} height={height} fill="white" rx={16} />

                {/* Staff lines */}

                {[0, 1, 2, 3, 4].map((i) => (
                    <line
                        key={i}
                        x1={staffLeft}
                        x2={staffRight}
                        y1={staffTop + i * lineGap}
                        y2={staffTop + i * lineGap}
                        stroke="#222"
                        strokeWidth={1.2}
                    />
                ))}

                {[
                    ...Array(nRows),
                ].map((value: undefined, rowi: number) => (
                    [0, 1, 2, 3, 4].map((i) => (
                        <line
                            key={i}
                            x1={staffLeft}
                            x2={staffRight}
                            y1={staffTop + i * lineGap + rowi * (lineGap * 4 + rowMargin)}
                            y2={staffTop + i * lineGap + rowi * (lineGap * 4 + rowMargin) }
                            stroke="#222"
                            strokeWidth={1.2}
                        />
                  ))
                ))}
              
                {/* Left label (simple treble indicator) */}
                <text x={12} y={staffMid + 6} fontSize={20} fill="#444" style={{ fontFamily: "serif" }}>
                    𝄞
                </text>

                {/* Vertical grid guidelines (subtle) */}
                {Array.from({ length: Math.floor((staffRight - staffLeft) / (beatWidth / 2)) + 1 }).map((_, i) => (
                    <line
                        key={`g${i}`}
                        x1={staffLeft + i * (beatWidth / 2)}
                        x2={staffLeft + i * (beatWidth / 2)}
                        y1={staffTop - 18}
                        y2={staffBottom + 18}
                        stroke="#ddd"
                        strokeDasharray="4 4"
                        strokeWidth={0.6}
                    />
                ))}

                {/* Measure markers: every 16 grid ticks draw a stronger vertical bar */}
                {Array.from({ length: RENDER_MEASURES }).map((_, mi) => {
                    const x = staffLeft + mi * 16 * tickWidth;
                    return (
                        <line key={`measure-${mi}`} x1={x} x2={x} y1={staffTop - 22} y2={staffBottom + 22} stroke="#999" strokeWidth={1.2} />
                    );
                })}

                {/* Notes: iterate measures and render each note */}
                {measures.map((m, mi) =>
                    m.notes.map((n) => {
                        const x = getNoteX(mi, n.tick);
                        const y = degreeToY(n.degree);
                        const { filled, showStem, flag } = durationToNotehead(n.duration);
                        const stemIsUp = stemUp(n.degree);
                        const stemX = stemIsUp ? x + 8 : x - 8;
                        const stemY2 = stemIsUp ? y - 35 : y + 35;
                        const isSelected = n.id === selectedId;

                        return (
                            <g key={n.id} onClick={(e) => { e.stopPropagation(); handleSelectNote(n.id); }}>
                                {/* ledger lines */}
                                {ledgerLineYs(n.degree).map((ly, idx) => (
                                    <line key={`ll${idx}`} x1={x - 14} x2={x + 14} y1={ly} y2={ly} stroke="#222" strokeWidth={1} />
                                ))}

                                {/* accidental */}
                                {n.accidental && (
                                    <text x={x - 20} y={y + 5} fontSize={16} fill="#111" style={{ fontFamily: "serif" }}>
                                        {accidentalGlyph(n.accidental)}
                                    </text>
                                )}

                                {/* notehead */}
                                <ellipse
                                    cx={x}
                                    cy={y}
                                    rx={9}
                                    ry={7}
                                    transform={`rotate(-20 ${x} ${y})`}
                                    fill={filled ? (isSelected ? "#2563eb" : "#111") : "white"}
                                    stroke={isSelected ? "#2563eb" : "#111"}
                                    strokeWidth={1.4}
                                />

                                {/* stem */}
                                {showStem && (
                                    <line x1={stemX} x2={stemX} y1={stemIsUp ? y - 1 : y + 1} y2={stemY2} stroke={isSelected ? "#2563eb" : "#111"} strokeWidth={1.4} />
                                )}

                                {/* simple flag for eighth notes */}
                                {flag && (
                                    <path
                                        d={stemIsUp ? `M ${stemX} ${stemY2} c 8 4, 16 8, 16 18 c -7 -5, -14 -7, -16 -8 z` : `M ${stemX} ${stemY2} c -8 -4, -16 -8, -16 -18 c 7 5, 14 7, 16 8 z`}
                                        fill={isSelected ? "#2563eb" : "#111"}
                                    />
                                )}
                            </g>
                        );
                    })
                )}
            </svg>

            {/* Legend & tips */}
            <div className="text-xs text-gray-500 mt-2 px-1">
                Click a note to select it. Use the toolbar to set duration & accidental. Press Delete/Backspace to remove a selected note. Use arrow keys to nudge pitch, or click the staff to move a selected note vertically.
            </div>
        </div>
    );
};

export default StaffNoteEditor;

// === Utilities ===
function cryptoRandomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
    return Math.random().toString(36).slice(2);
}
